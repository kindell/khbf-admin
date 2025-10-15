import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { useNavigate } from 'react-router-dom';
import { BroadcastComposer } from './components/BroadcastComposer';
import { BroadcastList } from './components/BroadcastList';
import './SMSInbox.css';

interface Thread {
  id: string;
  phone_number: string;
  member_id: string | null;
  member_name: string | null;
  last_message_at: string;
  last_message_text: string;
  unread_count: number;
}


interface SMSInboxProps {
  adminMemberId?: string;
  adminMemberName?: string;
}

export function SMSInbox({ adminMemberId, adminMemberName }: SMSInboxProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'conversations' | 'broadcasts'>('conversations');
  const [showComposer, setShowComposer] = useState(false);
  const [composerMode, setComposerMode] = useState<'broadcast' | 'conversation'>('broadcast');
  const navigate = useNavigate();

  useEffect(() => {
    loadThreads();

    // Realtime updates
    const subscription = supabase
      .channel('sms_threads_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'sms_threads' },
        () => loadThreads()
      )
      .subscribe();

    return () => { subscription.unsubscribe(); };
  }, []);

  async function loadThreads() {
    const { data, error } = await supabase
      .from('sms_threads')
      .select(`
        *,
        members:member_id (
          first_name,
          last_name
        )
      `)
      .eq('has_user_messages', true)  // Only show threads with user messages (not system-only)
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error('Failed to load threads:', error);
      setLoading(false);
      return;
    }

    if (data) {
      setThreads(data.map(t => ({
        ...t,
        member_name: t.members ?
          `${t.members.first_name} ${t.members.last_name}` :
          null
      })));
    }

    setLoading(false);
  }

  function formatTime(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just nu';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;

    return date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
  }

  return (
    <div className="sms-inbox-container">
      <div className="sms-inbox-header">
        <h1>📱 SMS Inbox</h1>
        {activeTab === 'conversations' && (
          <button
            className="new-chat-button"
            onClick={() => {
              setComposerMode('conversation');
              setShowComposer(true);
            }}
          >
            💬 Ny konversation
          </button>
        )}
        {activeTab === 'broadcasts' && (
          <button
            className="new-chat-button"
            onClick={() => {
              setComposerMode('broadcast');
              setShowComposer(true);
            }}
          >
            📢 Ny Broadcast
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="inbox-tabs">
        <button
          className={`tab ${activeTab === 'conversations' ? 'active' : ''}`}
          onClick={() => setActiveTab('conversations')}
        >
          💬 Konversationer
        </button>
        <button
          className={`tab ${activeTab === 'broadcasts' ? 'active' : ''}`}
          onClick={() => setActiveTab('broadcasts')}
        >
          📢 Broadcasts
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'conversations' ? (
        loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Laddar konversationer...</p>
          </div>
        ) : threads.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <h2>Inga konversationer än</h2>
            <p>Inkommande svar på dina meddelanden visas här</p>
          </div>
        ) : (
          <div className="thread-list">
            {threads.map(thread => (
              <div
                key={thread.id}
                className={`thread-item ${thread.unread_count > 0 ? 'unread' : ''}`}
                onClick={() => navigate(`/sms/${thread.id}`)}
              >
                <div className="thread-avatar">
                  {thread.member_name ? thread.member_name.charAt(0).toUpperCase() : '?'}
                </div>
                <div className="thread-content">
                  <div className="thread-header-row">
                    <strong className="thread-name">
                      {thread.member_name || thread.phone_number}
                    </strong>
                    <span className="thread-time">
                      {formatTime(thread.last_message_at)}
                    </span>
                  </div>
                  <div className="thread-preview-row">
                    <span className="thread-preview">
                      {thread.last_message_text}
                    </span>
                    {thread.unread_count > 0 && (
                      <span className="unread-badge">{thread.unread_count}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <BroadcastList />
      )}

      {showComposer && (
        <BroadcastComposer
          mode={composerMode}
          onClose={() => setShowComposer(false)}
          onSent={(threadId?: string) => {
            setShowComposer(false);
            if (composerMode === 'conversation' && threadId) {
              // Navigate to the new conversation
              navigate(`/sms/${threadId}`);
            } else {
              setActiveTab('broadcasts');
            }
          }}
        />
      )}
    </div>
  );
}
