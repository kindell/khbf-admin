import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { useNavigate } from 'react-router-dom';
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
  const [showNewChat, setShowNewChat] = useState(false);
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
        <button
          className="new-chat-button"
          onClick={() => setShowNewChat(true)}
        >
          ✏️ Ny konversation
        </button>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Laddar konversationer...</p>
        </div>
      ) : threads.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💬</div>
          <h2>Inga konversationer än</h2>
          <p>Skicka ett SMS eller starta en ny konversation</p>
          <button className="primary-button" onClick={() => setShowNewChat(true)}>
            Starta konversation
          </button>
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
      )}

      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onSelectMember={(memberId) => {
            setShowNewChat(false);
            // Navigate to thread for this member
            // We'll implement this in the next component
          }}
        />
      )}
    </div>
  );
}

// NewChatModal - Member selector for starting conversations
function NewChatModal({ onClose, onSelectMember }: any) {
  const [members, setMembers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (search.length >= 2) {
      loadMembers();
    } else {
      setMembers([]);
      setLoading(false);
    }
  }, [search]);

  async function loadMembers() {
    setLoading(true);

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
    if (/^\d+$/.test(search)) {
      query = query.eq('fortnox_customer_number', parseInt(search));
    } else {
      // Search by name (case insensitive)
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
    }

    const { data, error } = await query
      .order('first_name')
      .limit(50);

    if (error) {
      console.error('Failed to load members:', error);
      setLoading(false);
      return;
    }

    if (data) {
      setMembers(data.map(m => ({
        ...m,
        full_name: `${m.first_name} ${m.last_name}`,
        phone_number: m.phone_mappings[0]?.phone_number
      })));
    }

    setLoading(false);
  }

  async function handleSelectMember(member: any) {
    // Check if thread exists for this phone number
    const { data: existingThread } = await supabase
      .from('sms_threads')
      .select('id')
      .eq('phone_number', member.phone_number)
      .single();

    if (existingThread) {
      // Navigate to existing thread
      navigate(`/sms/${existingThread.id}`);
    } else {
      // Create new thread
      const { data: newThread, error } = await supabase
        .from('sms_threads')
        .insert({
          phone_number: member.phone_number,
          member_id: member.id,
          last_message_at: new Date().toISOString(),
          last_message_text: 'Ny konversation'
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create thread:', error);
        alert('Kunde inte skapa konversation');
        return;
      }

      if (newThread) {
        navigate(`/sms/${newThread.id}`);
      }
    }

    onClose();
  }

  const filteredMembers = members.filter(m =>
    m.full_name.toLowerCase().includes(search.toLowerCase()) ||
    m.fortnox_customer_number?.toString().includes(search) ||
    m.phone_number?.includes(search)
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content member-selector" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Ny konversation</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="search-box">
          <input
            type="text"
            placeholder="Sök medlem (namn, nummer, telefon)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Laddar medlemmar...</p>
          </div>
        ) : (
          <div className="member-list">
            {filteredMembers.length === 0 ? (
              <div className="empty-state">
                <p>Inga medlemmar hittades</p>
              </div>
            ) : (
              filteredMembers.map(member => (
                <div
                  key={member.id}
                  className="member-item"
                  onClick={() => handleSelectMember(member)}
                >
                  <div className="member-avatar">
                    {member.first_name ? member.first_name.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div className="member-info">
                    <div className="member-name">{member.full_name || 'Okänd medlem'}</div>
                    <div className="member-details">
                      {member.fortnox_customer_number && (
                        <span className="member-number">#{member.fortnox_customer_number}</span>
                      )}
                      {member.phone_number && (
                        <span className="member-phone">{member.phone_number}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
