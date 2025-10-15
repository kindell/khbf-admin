import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import '../SMSThread.css'; // For shared send-button styling
import './BroadcastComposer.css';

interface Recipient {
  id: string; // member_id or phone_number
  name: string;
  phone: string;
  type: 'member' | 'custom';
}

interface BroadcastComposerProps {
  mode?: 'broadcast' | 'conversation';
  onClose: () => void;
  onSent?: (threadId?: string) => void;
}

export function BroadcastComposer({ mode = 'broadcast', onClose, onSent }: BroadcastComposerProps) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchMembers();
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  }, [searchQuery]);

  async function searchMembers() {
    // Search by customer number (exact match) or name (partial match)
    let query = supabase
      .from('members')
      .select(`
        id,
        fortnox_customer_number,
        first_name,
        last_name,
        phone_mappings!inner(phone_number, is_primary)
      `)
      .eq('phone_mappings.is_primary', true);

    // If search is a number, search by customer number
    if (/^\d+$/.test(searchQuery)) {
      query = query.eq('fortnox_customer_number', parseInt(searchQuery));
    } else {
      // Search by name (case insensitive)
      query = query.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`);
    }

    const { data } = await query.order('first_name').limit(20);

    if (data) {
      const results = data
        .map(m => ({
          id: m.id,
          name: `${m.first_name} ${m.last_name}`,
          phone: m.phone_mappings[0]?.phone_number,
          number: m.fortnox_customer_number
        }))
        // Filter out already selected
        .filter(r => !recipients.some(rec => rec.id === r.id));

      setSearchResults(results);
      setShowResults(results.length > 0);
    }
  }

  function addRecipient(member: any) {
    // In conversation mode, only allow one recipient
    if (mode === 'conversation' && recipients.length >= 1) {
      return;
    }

    const recipient: Recipient = {
      id: member.id,
      name: member.name,
      phone: member.phone,
      type: 'member'
    };

    setRecipients([...recipients, recipient]);
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    searchInputRef.current?.focus();
  }

  function removeRecipient(id: string) {
    setRecipients(recipients.filter(r => r.id !== id));
  }

  async function handleSend() {
    if (recipients.length === 0 || !message.trim()) return;

    setSending(true);

    try {
      if (mode === 'conversation') {
        // For conversation mode, send directly to one recipient
        const recipient = recipients[0];

        // Find or create thread
        let { data: thread } = await supabase
          .from('sms_threads')
          .select('id')
          .eq('phone_number', recipient.phone)
          .single();

        // If no thread exists, create one
        if (!thread) {
          const { data: newThread, error: threadError } = await supabase
            .from('sms_threads')
            .insert({
              phone_number: recipient.phone,
              member_id: recipient.type === 'member' ? recipient.id : null,
              last_message_at: new Date().toISOString(),
              last_message_text: message.trim(),
              unread_count: 0,
              has_user_messages: true
            })
            .select()
            .single();

          if (threadError) throw threadError;
          thread = newThread;
        }

        // Queue the message
        const { error: queueError } = await supabase
          .from('sms_queue')
          .insert({
            direction: 'outbound',
            phone_number: recipient.phone,
            message: message.trim(),
            status: 'pending',
            is_system: false,
            thread_id: thread.id
          });

        if (queueError) throw queueError;

        console.log(`✅ Message sent to ${recipient.name}`);
        onSent?.(thread.id);
        onClose();
      } else {
        // Broadcast mode - original logic
        // Create broadcast record
        const { data: broadcast, error: broadcastError } = await supabase
          .from('sms_broadcasts')
          .insert({
            message: message.trim(),
            recipient_count: recipients.length
          })
          .select()
          .single();

        if (broadcastError) throw broadcastError;

        // Queue SMS for each recipient and create recipient records
        for (const recipient of recipients) {
          // Insert into sms_queue
          const { data: queuedSMS, error: queueError } = await supabase
            .from('sms_queue')
            .insert({
              direction: 'outbound',
              phone_number: recipient.phone,
              message: message.trim(),
              status: 'pending',
              is_system: false
            })
            .select()
            .single();

          if (queueError) {
            console.error('Failed to queue SMS:', queueError);
            continue;
          }

          // Create broadcast recipient record
          await supabase
            .from('sms_broadcast_recipients')
            .insert({
              broadcast_id: broadcast.id,
              phone_number: recipient.phone,
              member_id: recipient.type === 'member' ? recipient.id : null,
              queued_sms_id: queuedSMS.id,
              status: 'pending'
            });
        }

        console.log(`✅ Broadcast created with ${recipients.length} recipients`);
        onSent?.();
        onClose();
      }
    } catch (error) {
      console.error('Failed to send:', error);
      alert('Kunde inte skicka meddelandet');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content broadcast-composer" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{mode === 'conversation' ? '💬 Ny konversation' : '📢 Ny broadcast'}</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="composer-body">
          {/* Recipient input with tags */}
          <div className="recipient-input-container">
            <label>Till:</label>
            <div className="recipient-input">
              {recipients.map(recipient => (
                <div key={recipient.id} className="recipient-tag">
                  {recipient.name}
                  <button
                    type="button"
                    className="remove-recipient"
                    onClick={() => removeRecipient(recipient.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
                onBlur={() => setTimeout(() => setShowResults(false), 200)}
                placeholder={recipients.length === 0 ? "Sök medlem..." : ""}
                className="recipient-search"
                autoFocus
              />
            </div>

            {/* Search results dropdown */}
            {showResults && searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map(member => (
                  <div
                    key={member.id}
                    className="search-result-item"
                    onClick={() => addRecipient(member)}
                  >
                    <div className="result-avatar">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="result-info">
                      <div className="result-name">{member.name}</div>
                      <div className="result-details">
                        #{member.number} • {member.phone}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected recipients count */}
          {recipients.length > 0 && mode === 'broadcast' && (
            <div className="recipient-count">
              {recipients.length} mottagare valda
            </div>
          )}
          {mode === 'conversation' && recipients.length >= 1 && (
            <div className="recipient-count" style={{ color: '#48bb78' }}>
              ✓ Mottagare vald
            </div>
          )}

          {/* Message textarea */}
          <div className="message-input-container">
            <label>Meddelande:</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Skriv ditt meddelande..."
              className="message-textarea"
              rows={6}
            />
            <div className="char-count">
              {message.length} tecken
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="composer-actions">
          <button className="cancel-button" onClick={onClose}>
            Avbryt
          </button>
          <button
            className="send-button"
            onClick={handleSend}
            disabled={recipients.length === 0 || !message.trim() || sending}
            title={mode === 'conversation'
              ? `Skicka till ${recipients[0]?.name || 'mottagare'}`
              : `Skicka till ${recipients.length} ${recipients.length === 1 ? 'person' : 'personer'}`
            }
          >
            {sending ? '⏳' : '↑'}
          </button>
        </div>
      </div>
    </div>
  );
}
