import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './BroadcastList.css';

interface Broadcast {
  id: string;
  message: string;
  recipient_count: number;
  sent_at: string;
}

export function BroadcastList() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadBroadcasts();

    // Realtime updates
    const subscription = supabase
      .channel('broadcasts_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'sms_broadcasts' },
        () => loadBroadcasts()
      )
      .subscribe();

    return () => { subscription.unsubscribe(); };
  }, []);

  async function loadBroadcasts() {
    const { data, error } = await supabase
      .from('sms_broadcasts')
      .select('*')
      .order('sent_at', { ascending: false });

    if (error) {
      console.error('Failed to load broadcasts:', error);
      setLoading(false);
      return;
    }

    setBroadcasts(data || []);
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
    if (diffMins < 60) return `${diffMins}m sedan`;
    if (diffHours < 24) return `${diffHours}h sedan`;
    if (diffDays < 7) return `${diffDays}d sedan`;

    return date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
  }

  function truncateMessage(message: string, maxLength: number = 80) {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  }

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Laddar skickade meddelanden...</p>
      </div>
    );
  }

  if (broadcasts.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📤</div>
        <h2>Inga skickade meddelanden än</h2>
        <p>Broadcast-meddelanden du skickar visas här</p>
      </div>
    );
  }

  return (
    <div className="broadcast-list">
      {broadcasts.map(broadcast => (
        <div
          key={broadcast.id}
          className="broadcast-item"
          onClick={() => navigate(`/sms/broadcast/${broadcast.id}`)}
        >
          <div className="broadcast-icon">📤</div>
          <div className="broadcast-content">
            <div className="broadcast-header-row">
              <span className="broadcast-recipients">
                {broadcast.recipient_count} mottagare
              </span>
              <span className="broadcast-time">
                {formatTime(broadcast.sent_at)}
              </span>
            </div>
            <div className="broadcast-preview">
              {truncateMessage(broadcast.message)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
