import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import './SMSThread.css';

interface SMS {
  id: string;
  direction: 'inbound' | 'outbound';
  message: string;
  created_at: string;
  status: string;
  sent_at: string | null;
  received_at: string | null;
  is_system?: boolean;
}

interface ThreadInfo {
  phone_number: string;
  member_name: string | null;
  member_id: string | null;
}

export function SMSThread() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<SMS[]>([]);
  const [threadInfo, setThreadInfo] = useState<ThreadInfo | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deletingMessage, setDeletingMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!threadId) return;

    loadThread();
    loadMessages();
    markAsRead();

    // Realtime updates for new messages and status changes
    const subscription = supabase
      .channel(`sms_messages_${threadId}`)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sms_queue',
          filter: `thread_id=eq.${threadId}`
        },
        (payload) => {
          console.log('📨 New SMS received via realtime:', payload.new);
          setMessages(prev => {
            // Check if message already exists (optimistic update)
            const exists = prev.some(msg => msg.id === payload.new.id);
            if (exists) return prev;
            return [...prev, payload.new as SMS];
          });
          scrollToBottom();
        }
      )
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sms_queue',
          filter: `thread_id=eq.${threadId}`
        },
        (payload) => {
          console.log('✏️ SMS status updated via realtime:', payload.new);
          setMessages(prev =>
            prev.map(msg =>
              msg.id === payload.new.id ? (payload.new as SMS) : msg
            )
          );
        }
      )
      .subscribe((status) => {
        console.log('🔌 Realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to SMS updates for thread:', threadId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Realtime subscription error');
        } else if (status === 'TIMED_OUT') {
          console.warn('⏰ Realtime subscription timed out');
        }
      });

    return () => {
      console.log('🔌 Unsubscribing from SMS realtime updates');
      subscription.unsubscribe();
    };
  }, [threadId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function loadThread() {
    const { data } = await supabase
      .from('sms_threads')
      .select(`
        phone_number,
        member_id,
        members:member_id (
          first_name,
          last_name
        )
      `)
      .eq('id', threadId)
      .single();

    if (data) {
      setThreadInfo({
        phone_number: data.phone_number,
        member_id: data.member_id,
        member_name: data.members ?
          `${data.members.first_name} ${data.members.last_name}` :
          null
      });
    }
  }

  async function loadMessages() {
    const { data } = await supabase
      .from('sms_queue')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    setMessages(data || []);
    setLoading(false);
  }

  async function markAsRead() {
    await supabase
      .from('sms_threads')
      .update({ unread_count: 0 })
      .eq('id', threadId);
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !threadInfo) return;

    setSending(true);

    try {
      const { data, error } = await supabase
        .from('sms_queue')
        .insert({
          direction: 'outbound',
          phone_number: threadInfo.phone_number,
          message: newMessage.trim(),
          status: 'pending',
          thread_id: threadId
        })
        .select()
        .single();

      if (error) throw error;

      // Optimistically add message to the list immediately
      if (data) {
        setMessages(prev => [...prev, data as SMS]);
      }

      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Kunde inte skicka meddelandet');
    } finally {
      setSending(false);
    }
  }

  function formatMessageTime(dateString: string) {
    return new Date(dateString).toLocaleTimeString('sv-SE', {
      hour: '2-digit',
      minute: '2-digit'
    });
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

      // Remove from UI
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    } catch (error) {
      console.error('Failed to delete message:', error);
      alert('Kunde inte radera meddelandet');
    } finally {
      setDeletingMessage(null);
    }
  }

  async function deleteThread() {
    if (!confirm('Är du säker på att du vill radera hela tråden? Detta kan inte ångras.')) return;

    try {
      // First delete all messages in the thread
      const { error: messagesError } = await supabase
        .from('sms_queue')
        .delete()
        .eq('thread_id', threadId);

      if (messagesError) throw messagesError;

      // Then delete the thread itself
      const { error: threadError } = await supabase
        .from('sms_threads')
        .delete()
        .eq('id', threadId);

      if (threadError) throw threadError;

      // Navigate back to inbox
      navigate('/sms');
    } catch (error) {
      console.error('Failed to delete thread:', error);
      alert('Kunde inte radera tråden');
    }
  }

  if (loading) {
    return (
      <div className="sms-thread-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Laddar konversation...</p>
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
          <h2>{threadInfo?.member_name || threadInfo?.phone_number}</h2>
          {threadInfo?.member_name && (
            <span className="phone-number">{threadInfo.phone_number}</span>
          )}
        </div>
        <div className="thread-actions">
          {threadInfo?.member_id && (
            <button
              className="view-profile-button"
              onClick={() => navigate(`/medlem/${threadInfo.member_id}`)}
            >
              Visa profil
            </button>
          )}
          <button
            className="delete-thread-button"
            onClick={deleteThread}
            title="Radera tråd"
          >
            🗑️
          </button>
        </div>
      </div>

      <div className="messages-container">
        <div className="messages-list">
          {messages.length === 0 ? (
            <div className="empty-messages">
              <p>Inga meddelanden än. Skicka det första!</p>
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

      <form onSubmit={sendMessage} className="compose-area">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Skriv ett meddelande..."
          disabled={sending}
          className="message-input"
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className="send-button"
        >
          {sending ? '⏳' : '↑'}
        </button>
      </form>
    </div>
  );
}
