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

  // Realtime subscription for new broadcast messages
  useEffect(() => {
    if (!groupId) return;

    // Listen for new SMS messages with this broadcast_id
    const subscription = supabase
      .channel(`broadcast_messages_${groupId}`)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sms_queue',
          filter: `broadcast_id=eq.${groupId}`
        },
        (payload) => {
          const newSMS = payload.new as SMS;

          if (!newSMS.is_system) {
            setMessages(prev => {
              // Check if we already have this exact message (by ID)
              const exists = prev.some(msg => msg.id === newSMS.id);
              if (exists) return prev;

              // Check if we already have a message with same content and timestamp (deduplicate)
              const timestamp = new Date(newSMS.created_at).getTime();
              const roundedTimestamp = Math.floor(timestamp / 5000) * 5000;

              const duplicateExists = prev.some(msg => {
                const msgTimestamp = new Date(msg.created_at).getTime();
                const msgRoundedTimestamp = Math.floor(msgTimestamp / 5000) * 5000;
                return msg.message === newSMS.message && msgRoundedTimestamp === roundedTimestamp;
              });

              if (duplicateExists) return prev;

              return [...prev, newSMS];
            });
            scrollToBottom();
          }
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

    // Get ONLY the SMS messages that are part of this broadcast using broadcast_id
    const { data: smsData, error } = await supabase
      .from('sms_queue')
      .select('*')
      .eq('broadcast_id', groupId)
      .or('is_system.is.null,is_system.eq.false')  // Exclude system messages
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to load messages:', error);
      setLoading(false);
      return;
    }

    // Deduplicate messages - same message sent to multiple recipients should only show once
    const uniqueMessages: SMS[] = [];
    const seen = new Map<string, SMS>();

    for (const msg of (smsData as SMS[]) || []) {
      // Create a key based on message content and timestamp (rounded to nearest second)
      const timestamp = new Date(msg.created_at).getTime();
      const roundedTimestamp = Math.floor(timestamp / 5000) * 5000; // Round to nearest 5 seconds
      const key = `${msg.message}_${roundedTimestamp}`;

      if (!seen.has(key)) {
        seen.set(key, msg);
        uniqueMessages.push(msg);
      }
    }

    setMessages(uniqueMessages);
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
