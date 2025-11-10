import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import './ConversationInfo.css';

interface ConversationInfoProps {
  phoneNumber: string;
  memberName: string | null;
  memberId: string | null;
  threadId: string;
  onClose: () => void;
  onDelete?: () => void;
}

// Generate avatar color based on phone number
function getAvatarColor(identifier: string): string {
  const colors = [
    'from-blue-400 to-blue-600',
    'from-green-400 to-green-600',
    'from-purple-400 to-purple-600',
    'from-pink-400 to-pink-600',
    'from-yellow-400 to-yellow-600',
    'from-red-400 to-red-600',
    'from-indigo-400 to-indigo-600',
    'from-teal-400 to-teal-600'
  ];

  // Hash string to number
  const hash = identifier.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

export function ConversationInfo({
  phoneNumber,
  memberName,
  memberId,
  threadId,
  onClose,
  onDelete
}: ConversationInfoProps) {
  const navigate = useNavigate();
  const [isClosing, setIsClosing] = useState(false);

  function handleClose() {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300); // Match animation duration
  }

  async function handleDelete() {
    const displayName = memberName || phoneNumber;
    if (!confirm(`Är du säker på att du vill radera konversationen med ${displayName}?\n\nDetta kan inte ångras.`)) {
      return;
    }

    try {
      // Delete all messages in the thread
      await supabase
        .from('sms_queue')
        .delete()
        .eq('thread_id', threadId);

      // Delete the thread
      const { error } = await supabase
        .from('sms_threads')
        .delete()
        .eq('id', threadId);

      if (error) throw error;

      // Call onDelete callback or navigate
      if (onDelete) {
        onDelete();
      } else {
        navigate('/messages', { state: { animationDirection: 'back' } });
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      alert('Kunde inte radera konversationen');
    }
  }

  function goToMemberDetail() {
    if (memberId) {
      navigate(`/members/${memberId}`);
    }
  }

  // Get initials for avatar
  function getInitials(): string {
    if (memberName) {
      return memberName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return phoneNumber.slice(-2);
  }

  return (
    <div className={`conversation-info-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div className={`conversation-info-container ${isClosing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="conversation-info-header">
          <button className="conversation-info-done-button" onClick={handleClose}>
            Klar
          </button>
        </div>

        {/* Contact title */}
        <div className="conversation-info-title">
          <div
            className={`conversation-avatar-large bg-gradient-to-br ${getAvatarColor(phoneNumber)}`}
          >
            {getInitials()}
          </div>
          <h2>{memberName || phoneNumber}</h2>
          {memberName && <p className="conversation-subtitle">{phoneNumber}</p>}
        </div>

        {/* Contact info */}
        {memberId && (
          <div className="conversation-actions-section">
            <button
              className="conversation-action-button"
              onClick={goToMemberDetail}
            >
              Visa medlemsinfo
            </button>
          </div>
        )}

        {/* Delete button */}
        <div className="conversation-actions-section">
          <button
            className="conversation-delete-button"
            onClick={handleDelete}
          >
            Radera konversation
          </button>
        </div>
      </div>
    </div>
  );
}
