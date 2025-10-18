import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import './GroupInfo.css';

interface Recipient {
  phone_number: string;
  member_id: string | null;
  status: string;
  member_name?: string;
}

interface GroupInfoProps {
  recipients: Recipient[];
  recipientCount: number;
  groupId: string;
  groupName?: string | null;
  onClose: () => void;
  onDelete?: () => void;
  onNameUpdate?: (newName: string) => void;
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

export function GroupInfo({ recipients, recipientCount, groupId, groupName, onClose, onDelete, onNameUpdate }: GroupInfoProps) {
  const navigate = useNavigate();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(groupName || '');
  const [isClosing, setIsClosing] = useState(false);

  function handleClose() {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300); // Match animation duration
  }

  async function handleDelete() {
    if (!confirm(`Är du säker på att du vill radera detta gruppmeddelande till ${recipientCount} mottagare?\n\nDetta kan inte ångras.`)) {
      return;
    }

    try {
      // First, get all queued_sms_id's for this broadcast
      const { data: broadcastRecipients } = await supabase
        .from('sms_broadcast_recipients')
        .select('queued_sms_id')
        .eq('broadcast_id', groupId);

      // Delete the specific SMS messages that belong to this broadcast
      if (broadcastRecipients && broadcastRecipients.length > 0) {
        const smsIds = broadcastRecipients
          .map(r => r.queued_sms_id)
          .filter(id => id !== null);

        if (smsIds.length > 0) {
          await supabase
            .from('sms_queue')
            .delete()
            .in('id', smsIds);
        }
      }

      // Delete broadcast recipients
      await supabase
        .from('sms_broadcast_recipients')
        .delete()
        .eq('broadcast_id', groupId);

      // Delete broadcast
      const { error } = await supabase
        .from('sms_broadcasts')
        .delete()
        .eq('id', groupId);

      if (error) throw error;

      // Call onDelete callback
      if (onDelete) {
        onDelete();
      } else {
        // Fallback to navigating to inbox
        navigate('/messages', { state: { animationDirection: 'back' } });
      }
    } catch (error) {
      console.error('Failed to delete broadcast:', error);
      alert('Kunde inte radera gruppmeddelandet');
    }
  }

  async function handleSaveName() {
    try {
      const { error } = await supabase
        .from('sms_broadcasts')
        .update({ name: editedName.trim() || null })
        .eq('id', groupId);

      if (error) throw error;

      setIsEditingName(false);
      if (onNameUpdate) {
        onNameUpdate(editedName.trim());
      }
    } catch (error) {
      console.error('Failed to update group name:', error);
      alert('Kunde inte uppdatera gruppnamnet');
    }
  }

  async function openConversation(recipient: Recipient) {
    // Try to find an existing thread for this phone number
    const { data: thread } = await supabase
      .from('sms_threads')
      .select('id')
      .eq('phone_number', recipient.phone_number)
      .eq('has_user_messages', true)
      .single();

    if (thread) {
      // Navigate to the thread
      navigate(`/messages/${thread.id}`, { state: { animationDirection: 'forward' } });
    } else {
      // No conversation yet
      alert(`Ingen konversation med ${recipient.member_name || recipient.phone_number} än.\nDe måste skicka ett meddelande först för att starta en konversation.`);
    }
  }

  // Get initials for avatar
  function getInitials(recipient: Recipient): string {
    if (recipient.member_name) {
      return recipient.member_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return recipient.phone_number.slice(-2);
  }

  return (
    <div className={`group-info-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div className={`group-info-container ${isClosing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="group-info-header">
          <button className="group-info-done-button" onClick={handleClose}>
            Klar
          </button>
        </div>

        {/* Group title */}
        <div className="group-info-title">
          <div className="group-icon-large">📢</div>
          {isEditingName ? (
            <div className="edit-name-container">
              <input
                type="text"
                className="edit-name-input"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder="Gruppnamn"
                autoFocus
                maxLength={50}
              />
              <div className="edit-name-buttons">
                <button
                  className="edit-name-cancel"
                  onClick={() => {
                    setEditedName(groupName || '');
                    setIsEditingName(false);
                  }}
                >
                  Avbryt
                </button>
                <button
                  className="edit-name-save"
                  onClick={handleSaveName}
                >
                  Spara
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2 onClick={() => setIsEditingName(true)} style={{ cursor: 'pointer' }}>
                {groupName || `${recipientCount} mottagare`}
              </h2>
              <p className="group-subtitle">
                {groupName ? `${recipientCount} mottagare` : 'Gruppmeddelande'} • Tryck för att namnge
              </p>
            </>
          )}
        </div>

        {/* Recipients list */}
        <div className="group-members-section">
          <div className="group-members-header">
            <span className="group-members-count">{recipientCount} mottagare</span>
          </div>
          <div className="group-members-list">
            {recipients.map((recipient, idx) => (
              <div
                key={idx}
                className="group-member-item"
                onClick={() => openConversation(recipient)}
              >
                <div
                  className={`member-avatar bg-gradient-to-br ${getAvatarColor(recipient.phone_number)}`}
                >
                  {getInitials(recipient)}
                </div>
                <div className="member-info">
                  <div className="member-name">
                    {recipient.member_name || recipient.phone_number}
                  </div>
                  <div className="member-phone">
                    {recipient.phone_number}
                  </div>
                </div>
                <svg
                  className="member-chevron"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            ))}
          </div>
        </div>

        {/* Delete button */}
        <div className="group-actions-section">
          <button
            className="group-delete-button"
            onClick={handleDelete}
          >
            Radera gruppmeddelande
          </button>
        </div>
      </div>
    </div>
  );
}
