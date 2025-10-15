import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import '../SMSThread.css';

interface BroadcastMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  phone_number: string;
  message: string;
  created_at: string;
  status: string;
  member_name?: string;
  broadcast_id?: string | null;
}

interface GroupedMessage {
  id: string;
  type: 'broadcast' | 'reply';
  message: string;
  created_at: string;
  direction: 'inbound' | 'outbound';
  status?: string;
  member_name?: string;
  phone_number?: string;  // Add phone number for inbound messages
  recipient_count?: number;
  message_ids?: string[];
  recipient_names?: string[];
  recipient_phones?: string[];
}

interface BroadcastInfo {
  message: string;
  recipient_count: number;
  sent_at: string;
  recipients: Array<{
    phone_number: string;
    member_id: string | null;
    status: string;
    member_name?: string;
  }>;
}

export function BroadcastDetail() {
  const { broadcastId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<BroadcastMessage[]>([]);
  const [groupedMessages, setGroupedMessages] = useState<GroupedMessage[]>([]);
  const [broadcastInfo, setBroadcastInfo] = useState<BroadcastInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingMessage, setDeletingMessage] = useState<string | null>(null);
  const [showRecipients, setShowRecipients] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!broadcastId) return;

    loadBroadcast();
    loadMessages();
  }, [broadcastId]);

  // Separate useEffect for realtime subscription
  useEffect(() => {
    if (!broadcastId || !broadcastInfo) return;

    const recipientPhones = broadcastInfo.recipients.map(r => r.phone_number);

    // Realtime subscription for new messages (both inbound and outbound)
    const subscription = supabase
      .channel(`broadcast_messages_${broadcastId}`)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sms_queue',
        },
        async (payload) => {
          const newMessage = payload.new;

          // Check if this message is from one of our broadcast recipients
          const isFromRecipient = recipientPhones.includes(newMessage.phone_number);

          if (isFromRecipient) {
            // Get member name if exists
            const { data: phoneMapping } = await supabase
              .from('phone_mappings')
              .select('members(first_name, last_name)')
              .eq('phone_number', newMessage.phone_number)
              .single();

            const memberName = phoneMapping?.members
              ? `${phoneMapping.members.first_name} ${phoneMapping.members.last_name}`
              : null;

            setMessages(prev => {
              const exists = prev.some(msg => msg.id === newMessage.id);
              if (exists) return prev;
              return [...prev, { ...newMessage, member_name: memberName } as BroadcastMessage];
            });
            scrollToBottom();
          }
        }
      )
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sms_queue',
        },
        (payload) => {
          setMessages(prev =>
            prev.map(msg =>
              msg.id === payload.new.id ? { ...msg, ...payload.new } as BroadcastMessage : msg
            )
          );
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [broadcastId, broadcastInfo]);

  useEffect(() => {
    scrollToBottom();
  }, [groupedMessages]);

  // Group messages: broadcast messages (same text) together, individual replies separate
  useEffect(() => {
    if (messages.length === 0) {
      setGroupedMessages([]);
      return;
    }

    const grouped: GroupedMessage[] = [];
    const processedIds = new Set<string>();

    messages.forEach(msg => {
      if (processedIds.has(msg.id)) return;

      // If it's an outbound message, try to group with other outbound messages with same text
      if (msg.direction === 'outbound') {
        const sameBroadcast = messages.filter(
          m => m.direction === 'outbound' &&
               m.message === msg.message &&
               !processedIds.has(m.id)
        );

        sameBroadcast.forEach(m => processedIds.add(m.id));

        // Get the actual recipient names and phone numbers for this specific broadcast
        const recipientNames = sameBroadcast
          .map(m => m.member_name || m.phone_number)
          .filter((name, index, self) => self.indexOf(name) === index); // Remove duplicates

        const recipientPhones = sameBroadcast
          .map(m => m.phone_number)
          .filter((phone, index, self) => self.indexOf(phone) === index); // Remove duplicates

        // Always show outbound messages as broadcasts in broadcast view
        grouped.push({
          id: msg.id,
          type: 'broadcast',
          message: msg.message,
          created_at: msg.created_at,
          direction: 'outbound',
          status: msg.status,
          recipient_count: sameBroadcast.length,
          message_ids: sameBroadcast.map(m => m.id),
          recipient_names: recipientNames,
          recipient_phones: recipientPhones
        });
      }
      // Individual replies
      else if (msg.direction === 'inbound') {
        processedIds.add(msg.id);
        grouped.push({
          id: msg.id,
          type: 'reply',
          message: msg.message,
          created_at: msg.created_at,
          direction: 'inbound',
          member_name: msg.member_name,
          phone_number: msg.phone_number  // Store phone number for linking
        });
      }
    });

    // Sort by created_at
    grouped.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    console.log('📊 Grouped messages:', grouped);
    setGroupedMessages(grouped);
  }, [messages, broadcastId]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function loadBroadcast() {
    const { data, error } = await supabase
      .from('sms_broadcasts')
      .select(`
        *,
        sms_broadcast_recipients(
          phone_number,
          member_id,
          status,
          members(first_name, last_name)
        )
      `)
      .eq('id', broadcastId)
      .single();

    if (error) {
      console.error('Failed to load broadcast:', error);
      return;
    }

    const recipientsWithNames = data.sms_broadcast_recipients?.map(r => ({
      ...r,
      member_name: r.members
        ? `${r.members.first_name} ${r.members.last_name}`
        : null
    })) || [];

    // Remove duplicates based on phone_number
    const uniqueRecipients = recipientsWithNames.filter((recipient, index, self) =>
      index === self.findIndex(r => r.phone_number === recipient.phone_number)
    );

    setBroadcastInfo({
      message: data.message,
      recipient_count: data.recipient_count,
      sent_at: data.sent_at,
      recipients: uniqueRecipients
    });
  }

  async function loadMessages() {
    if (!broadcastId) return;

    // Get all recipient phone numbers
    const { data: recipients, error: recipientsError } = await supabase
      .from('sms_broadcast_recipients')
      .select('phone_number')
      .eq('broadcast_id', broadcastId);

    if (!recipients || recipients.length === 0) {
      setLoading(false);
      return;
    }

    const phoneNumbers = recipients.map(r => r.phone_number);

    // Get all messages (outbound from broadcast + inbound replies)
    const { data: smsData, error } = await supabase
      .from('sms_queue')
      .select('*')
      .in('phone_number', phoneNumbers)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to load messages:', error);
      setLoading(false);
      return;
    }

    if (smsData && smsData.length > 0) {
      // Get member names for all phone numbers
      const { data: phoneMappings } = await supabase
        .from('phone_mappings')
        .select('phone_number, members(first_name, last_name)')
        .in('phone_number', phoneNumbers);

      // Create a map of phone_number -> member_name
      const nameMap = new Map<string, string>();
      phoneMappings?.forEach(pm => {
        if (pm.members) {
          nameMap.set(pm.phone_number, `${pm.members.first_name} ${pm.members.last_name}`);
        }
      });

      const messagesWithNames = smsData.map(msg => ({
        ...msg,
        member_name: nameMap.get(msg.phone_number) || null
      }));

      setMessages(messagesWithNames);
    } else {
      setMessages([]);
    }

    setLoading(false);
  }

  async function deleteMessage(messageId: string) {
    if (!confirm('Är du säker på att du vill radera detta meddelande?')) return;

    setDeletingMessage(messageId);

    try {
      const { error } = await supabase
        .from('sms_queue')
        .delete()
        .eq('id', messageId);

      if (error) throw error;

      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    } catch (error) {
      console.error('Failed to delete message:', error);
      alert('Kunde inte radera meddelandet');
    } finally {
      setDeletingMessage(null);
    }
  }

  async function deleteBroadcast() {
    if (!confirm('Är du säker på att du vill radera hela broadcasten? Detta kan inte ångras.')) return;

    try {
      // Delete all associated messages
      const phoneNumbers = broadcastInfo?.recipients.map(r => r.phone_number) || [];

      if (phoneNumbers.length > 0) {
        await supabase
          .from('sms_queue')
          .delete()
          .in('phone_number', phoneNumbers);
      }

      // Delete broadcast recipients
      await supabase
        .from('sms_broadcast_recipients')
        .delete()
        .eq('broadcast_id', broadcastId);

      // Delete broadcast
      const { error } = await supabase
        .from('sms_broadcasts')
        .delete()
        .eq('id', broadcastId);

      if (error) throw error;

      navigate('/sms');
    } catch (error) {
      console.error('Failed to delete broadcast:', error);
      alert('Kunde inte radera broadcasten');
    }
  }

  function formatMessageTime(dateString: string) {
    return new Date(dateString).toLocaleTimeString('sv-SE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  async function openConversation(phoneNumber: string, recipientName: string) {
    // Try to find an existing thread for this phone number
    const { data: thread, error } = await supabase
      .from('sms_threads')
      .select('id')
      .eq('phone_number', phoneNumber)
      .eq('has_user_messages', true)
      .single();

    if (error || !thread) {
      alert(`Ingen konversation med ${recipientName} än.\nDe måste skicka ett meddelande först för att starta en konversation.`);
      return;
    }

    // Navigate to the thread
    navigate(`/sms/${thread.id}`);
  }

  async function sendToAll() {
    if (!newMessage.trim() || !broadcastInfo) return;

    // Confirmation dialog
    const preview = newMessage.length > 100 ? newMessage.substring(0, 100) + '...' : newMessage;
    if (!confirm(
      `Skicka detta meddelande till ${broadcastInfo.recipients.length} mottagare?\n\n` +
      `"${preview}"\n\n` +
      `Detta kan inte ångras.`
    )) {
      return;
    }

    setSending(true);

    try {
      console.log('📤 Sending message to', broadcastInfo.recipients.length, 'recipients');

      // Queue message for each recipient and create broadcast recipient records
      for (const recipient of broadcastInfo.recipients) {
        // Insert into sms_queue
        const { data: queuedSMS, error: queueError } = await supabase
          .from('sms_queue')
          .insert({
            phone_number: recipient.phone_number,
            message: newMessage.trim(),
            direction: 'outbound',
            status: 'pending',
            is_system: false
          })
          .select()
          .single();

        if (queueError) {
          console.error('Failed to queue SMS:', queueError);
          throw queueError;
        }

        // Create broadcast recipient record
        const { error: recipientError } = await supabase
          .from('sms_broadcast_recipients')
          .insert({
            broadcast_id: broadcastId,
            phone_number: recipient.phone_number,
            member_id: recipient.member_id,
            queued_sms_id: queuedSMS.id,
            status: 'pending'
          });

        if (recipientError) {
          console.error('Failed to create broadcast recipient:', recipientError);
          throw recipientError;
        }
      }

      console.log('✅ All messages queued successfully');
      setNewMessage('');

      // Reload messages after a short delay to ensure DB has committed
      setTimeout(() => {
        loadMessages();
      }, 500);
    } catch (error: any) {
      console.error('Failed to send messages:', error);
      alert(`Kunde inte skicka meddelanden\n\nFel: ${error?.message || 'Okänt fel'}`);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="sms-thread-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Laddar broadcast...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sms-thread-container">
      <div className="thread-header">
        <button className="back-button" onClick={() => navigate('/sms')}>
          ← Tillbaka
        </button>
        <div className="thread-info">
          <h2>📤 Broadcast</h2>
          <button
            className="phone-number"
            onClick={() => setShowRecipients(!showRecipients)}
            style={{
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              padding: 0,
              textDecoration: showRecipients ? 'underline' : 'none'
            }}
          >
            {broadcastInfo?.recipient_count} mottagare {showRecipients ? '▼' : '▶'}
          </button>
        </div>
        <div className="thread-actions">
          <button
            className="delete-thread-button"
            onClick={deleteBroadcast}
            title="Radera broadcast"
          >
            🗑️
          </button>
        </div>
      </div>

      {showRecipients && broadcastInfo && (
        <div style={{
          background: 'white',
          borderBottom: '1px solid #e2e8f0',
          padding: '15px 20px',
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#718096' }}>
            Mottagare:
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {broadcastInfo.recipients.map((recipient, idx) => (
              <div key={idx} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px',
                background: '#f7fafc',
                borderRadius: '6px'
              }}>
                <span style={{ fontWeight: 500 }}>
                  {recipient.member_name || recipient.phone_number}
                </span>
                <span style={{ color: '#718096', fontSize: '0.9rem' }}>
                  {recipient.phone_number}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="messages-container">
        <div className="messages-list">
          {groupedMessages.length === 0 ? (
            <div className="empty-messages">
              <p>Inga meddelanden än</p>
            </div>
          ) : (
            groupedMessages.map(msg => (
              <div
                key={msg.id}
                className={`message ${msg.direction} ${msg.type === 'broadcast' ? 'broadcast' : ''}`}
              >
                <div className="message-bubble">
                  {msg.type === 'broadcast' && msg.message_ids && (
                    <button
                      className="delete-message-button"
                      onClick={() => {
                        if (confirm(`Radera detta broadcast-meddelande till ${msg.recipient_count} mottagare?`)) {
                          msg.message_ids?.forEach(id => deleteMessage(id));
                        }
                      }}
                      title="Radera broadcast-meddelande"
                    >
                      ✕
                    </button>
                  )}
                  {msg.type === 'reply' && (
                    <button
                      className="delete-message-button"
                      onClick={() => deleteMessage(msg.id)}
                      disabled={deletingMessage === msg.id}
                      title="Radera meddelande"
                    >
                      ✕
                    </button>
                  )}
                  {msg.type === 'broadcast' ? (
                    <div className="message-sender" style={{ opacity: 0.7, fontSize: '0.75rem' }}>
                      Till: {msg.recipient_count === broadcastInfo?.recipient_count
                        ? 'Samtliga'
                        : msg.recipient_names?.map((name, idx) => (
                            <span key={idx}>
                              {idx > 0 && ', '}
                              <a
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (msg.recipient_phones?.[idx]) {
                                    openConversation(msg.recipient_phones[idx], name);
                                  }
                                }}
                                style={{
                                  color: 'inherit',
                                  textDecoration: 'underline',
                                  cursor: 'pointer'
                                }}
                              >
                                {name}
                              </a>
                            </span>
                          )) || 'Unknown'}
                    </div>
                  ) : (
                    (msg.member_name || msg.phone_number) && (
                      <div className="message-sender" style={{ opacity: 0.7, fontSize: '0.75rem' }}>
                        Från: <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (msg.phone_number) {
                              openConversation(msg.phone_number, msg.member_name || msg.phone_number);
                            }
                          }}
                          style={{
                            color: 'inherit',
                            textDecoration: 'underline',
                            cursor: 'pointer'
                          }}
                        >
                          {msg.member_name || msg.phone_number}
                        </a>
                      </div>
                    )
                  )}
                  <div className="message-text">{msg.message}</div>
                  <div className="message-meta">
                    <span className="message-time">
                      {formatMessageTime(msg.created_at)}
                    </span>
                    {msg.direction === 'outbound' && (
                      <span className={`message-status status-${msg.status}`}>
                        {msg.status === 'sent' ? '✓' : msg.status === 'pending' ? '○' : '✗'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Compose area for sending to all */}
      <div className="compose-area">
        <input
          type="text"
          className="message-input broadcast-input"
          placeholder={`⚠️ Broadcast till ${broadcastInfo?.recipient_count || 0} mottagare`}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendToAll();
            }
          }}
          disabled={sending}
        />
        <button
          className="send-button"
          onClick={sendToAll}
          disabled={!newMessage.trim() || sending}
          title="Skicka till alla"
        >
          {sending ? '⏳' : '↑'}
        </button>
      </div>
    </div>
  );
}
