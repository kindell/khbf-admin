import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { MobileContainer } from './layout/MobileContainer';
import { MessageBubble } from './sms/MessageBubble';
import { ThreadHeader } from './sms/ThreadHeader';
import { MessageInput } from './sms/MessageInput';
import { GroupInfo } from './sms/GroupInfo';
import { groupMessages } from '../lib/messageGrouping';
import { useSidebar } from '../contexts/SidebarContext';

interface SMS {
  id: string;
  direction: 'outbound';
  phone_number: string;
  message: string;
  created_at: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  sent_at: string | null;
  is_system?: boolean;
}

interface GroupDetailInfo {
  message: string;
  recipient_count: number;
  sent_at: string;
  name?: string | null;
  recipients: Array<{
    phone_number: string;
    member_id: string | null;
    status: string;
    member_name?: string;
  }>;
}

export function GroupDetail() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { openSidebar } = useSidebar();
  const [messages, setMessages] = useState<SMS[]>([]);
  const [groupInfo, setGroupInfo] = useState<GroupDetailInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Group messages using Apple Messages style grouping
  const groupedMessages = useMemo(() => groupMessages(messages), [messages]);

  useEffect(() => {
    if (!groupId) return;

    loadGroup();
    loadMessages();
  }, [groupId]);

  // Realtime subscription for broadcast updates
  useEffect(() => {
    if (!groupId) return;

    // Listen for updates to the broadcast (when new messages are sent)
    const subscription = supabase
      .channel(`broadcast_${groupId}`)
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sms_broadcasts',
          filter: `id=eq.${groupId}`
        },
        (payload) => {
          const updated = payload.new as any;

          // Update the displayed message with the new broadcast message
          setMessages([{
            id: groupId,
            direction: 'outbound',
            phone_number: '',
            message: updated.message,
            created_at: updated.sent_at || updated.created_at,
            status: 'sent',
            sent_at: updated.sent_at,
            is_system: false
          }]);

          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [groupId]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function loadGroup() {
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
      .eq('id', groupId)
      .single();

    if (error) {
      console.error('Failed to load broadcast:', error);
      return;
    }

    const recipientsWithNames = data.sms_broadcast_recipients?.map((r: any) => ({
      ...r,
      member_name: r.members
        ? `${r.members.first_name} ${r.members.last_name}`
        : null
    })) || [];

    // Remove duplicates based on phone_number
    const uniqueRecipients = recipientsWithNames.filter((recipient: any, index: number, self: any[]) =>
      index === self.findIndex((r: any) => r.phone_number === recipient.phone_number)
    );

    setGroupInfo({
      message: data.message,
      recipient_count: data.recipient_count,
      sent_at: data.sent_at,
      name: data.name,
      recipients: uniqueRecipients
    });
  }

  async function loadMessages() {
    if (!groupId) return;

    // For broadcasts, we only want to show the broadcast message template
    // not all the individual personalized messages
    const { data: broadcast, error } = await supabase
      .from('sms_broadcasts')
      .select('message, sent_at, created_at')
      .eq('id', groupId)
      .single();

    if (error) {
      console.error('Failed to load broadcast:', error);
      setLoading(false);
      return;
    }

    // Create a single message representing the broadcast
    if (broadcast) {
      setMessages([{
        id: groupId,
        direction: 'outbound',
        phone_number: '',
        message: broadcast.message,
        created_at: broadcast.sent_at || broadcast.created_at,
        status: 'sent',
        sent_at: broadcast.sent_at,
        is_system: false
      }]);
    }

    setLoading(false);
  }

  async function sendMessage(messageText: string) {
    if (!messageText.trim() || !groupInfo) return;

    setSending(true);

    try {
      console.log('📤 Sending message to', groupInfo.recipients.length, 'recipients');

      // Update broadcast with latest message and timestamp
      const { error: broadcastError } = await supabase
        .from('sms_broadcasts')
        .update({
          message: messageText.trim(),
          sent_at: new Date().toISOString()
        })
        .eq('id', groupId);

      if (broadcastError) {
        console.error('❌ Failed to update broadcast:', broadcastError);
        throw broadcastError;
      }

      console.log('✅ Broadcast updated');

      // Queue message for each recipient
      for (const recipient of groupInfo.recipients) {
        console.log('📨 Queuing SMS for:', recipient.phone_number);

        // Insert into sms_queue with broadcast_id
        const { error: queueError } = await supabase
          .from('sms_queue')
          .insert({
            phone_number: recipient.phone_number,
            message: messageText.trim(),
            direction: 'outbound',
            status: 'pending',
            is_system: false,
            broadcast_id: groupId
          });

        if (queueError) {
          console.error('❌ Failed to queue SMS:', queueError);
          throw queueError;
        }

        console.log('✅ SMS queued');
      }

      console.log('✅ All messages queued successfully');
    } catch (error: any) {
      console.error('❌ Failed to send messages:', error);
      alert(`Kunde inte skicka meddelanden\n\nFel: ${error?.message || 'Okänt fel'}`);
    } finally {
      setSending(false);
      console.log('🔄 Sending state reset');
    }
  }

  if (loading) {
    return (
      <div className="fixed top-0 left-64 right-0 bottom-0 flex flex-col bg-gray-50 overflow-hidden">
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <div className="w-10 h-10 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
          <p>Laddar grupp...</p>
        </div>
      </div>
    );
  }

  return (
    <MobileContainer className="overflow-hidden">
      {/* Thread Header */}
      <ThreadHeader
        contactName={groupInfo?.name || `${groupInfo?.recipient_count || 0} mottagare`}
        phoneNumber=""
        subtitle={groupInfo?.name ? `${groupInfo.recipient_count} mottagare` : "Gruppmeddelande"}
        onBack={() => navigate('/messages', { state: { animationDirection: 'back' } })}
        onMenu={openSidebar}
        onInfo={() => setShowGroupInfo(true)}
      />

      {/* Messages */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-gray-50 w-full"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="py-4 px-6 w-full box-border">
          {messages.length === 0 ? (
            <div className="text-center py-15 px-5 text-gray-400">
              <p>Inga meddelanden än. Skicka det första!</p>
            </div>
          ) : (
            groupedMessages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg.message}
                direction={msg.direction}
                timestamp={msg.created_at}
                status={msg.status}
                isFirstInGroup={msg.isFirstInGroup}
                isLastInGroup={msg.isLastInGroup}
                showTimestampOnLoad={msg.showTimestampOnLoad}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <MessageInput
        onSend={(msg) => sendMessage(msg)}
        disabled={sending}
        placeholder={
          groupInfo?.name
            ? `Meddelande till ${groupInfo.name}`
            : `Meddelande till ${groupInfo?.recipient_count || 0} mottagare`
        }
      />

      {/* Group Info */}
      {showGroupInfo && groupInfo && (
        <GroupInfo
          recipients={groupInfo.recipients}
          recipientCount={groupInfo.recipient_count}
          groupId={groupId!}
          groupName={groupInfo.name}
          onClose={() => setShowGroupInfo(false)}
          onDelete={() => navigate('/messages', { state: { animationDirection: 'back' } })}
          onNameUpdate={(newName) => {
            setGroupInfo({ ...groupInfo, name: newName });
          }}
        />
      )}
    </MobileContainer>
  );
}
