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
}

interface BroadcastInfo {
  message: string;
  recipient_count: number;
  sent_at: string;
  recipients: Array<{
    phone_number: string;
    member_id: string | null;
    status: string;
  }>;
}

export function BroadcastDetail() {
  const { broadcastId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<BroadcastMessage[]>([]);
  const [broadcastInfo, setBroadcastInfo] = useState<BroadcastInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingMessage, setDeletingMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!broadcastId) return;

    loadBroadcast();
    loadMessages();

    // Realtime subscription for new incoming messages (replies)
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
          const isFromRecipient = broadcastInfo?.recipients.some(
            r => r.phone_number === newMessage.phone_number
          );

          if (isFromRecipient && newMessage.direction === 'inbound') {
            console.log('📨 Reply received via realtime:', newMessage);

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
          console.log('✏️ Message status updated via realtime:', payload.new);
          setMessages(prev =>
            prev.map(msg =>
              msg.id === payload.new.id ? { ...msg, ...payload.new } as BroadcastMessage : msg
            )
          );
        }
      )
      .subscribe((status) => {
        console.log('🔌 Broadcast realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Subscribed to broadcast updates for:', broadcastId);
        }
      });

    return () => {
      console.log('🔌 Unsubscribing from broadcast realtime updates');
      subscription.unsubscribe();
    };
  }, [broadcastId, broadcastInfo?.recipients]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function loadBroadcast() {
    const { data, error } = await supabase
      .from('sms_broadcasts')
      .select(`
        *,
        sms_broadcast_recipients(phone_number, member_id, status)
      `)
      .eq('id', broadcastId)
      .single();

    if (error) {
      console.error('Failed to load broadcast:', error);
      return;
    }

    setBroadcastInfo({
      message: data.message,
      recipient_count: data.recipient_count,
      sent_at: data.sent_at,
      recipients: data.sms_broadcast_recipients || []
    });
  }

  async function loadMessages() {
    if (!broadcastId) return;

    // Get all recipient phone numbers
    const { data: recipients } = await supabase
      .from('sms_broadcast_recipients')
      .select('phone_number')
      .eq('broadcast_id', broadcastId);

    if (!recipients) {
      setLoading(false);
      return;
    }

    const phoneNumbers = recipients.map(r => r.phone_number);

    // Get all messages (outbound from broadcast + inbound replies)
    const { data: smsData } = await supabase
      .from('sms_queue')
      .select(`
        *,
        phone_mappings!inner(phone_number, members(first_name, last_name))
      `)
      .in('phone_number', phoneNumbers)
      .order('created_at', { ascending: true });

    if (smsData) {
      const messagesWithNames = smsData.map(msg => ({
        ...msg,
        member_name: msg.phone_mappings?.members
          ? `${msg.phone_mappings.members.first_name} ${msg.phone_mappings.members.last_name}`
          : null
      }));
      setMessages(messagesWithNames);
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
          <span className="phone-number">
            {broadcastInfo?.recipient_count} mottagare
          </span>
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

      <div className="messages-container">
        <div className="messages-list">
          {messages.length === 0 ? (
            <div className="empty-messages">
              <p>Inga meddelanden än</p>
            </div>
          ) : (
            messages.map(msg => (
              <div
                key={msg.id}
                className={`message ${msg.direction} ${deletingMessage === msg.id ? 'deleting' : ''}`}
              >
                <div className="message-bubble">
                  <button
                    className="delete-message-button"
                    onClick={() => deleteMessage(msg.id)}
                    disabled={deletingMessage === msg.id}
                    title="Radera meddelande"
                  >
                    ✕
                  </button>
                  {msg.direction === 'inbound' && msg.member_name && (
                    <div className="message-sender">{msg.member_name}</div>
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
    </div>
  );
}
