import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { MobileContainer } from './components/layout/MobileContainer';
import { MessageBubble } from './components/sms/MessageBubble';
import { ThreadHeader } from './components/sms/ThreadHeader';
import { MessageInput, type MessageInputRef } from './components/sms/MessageInput';
import { VariableHelper } from './components/sms/VariableHelper';
import { ConversationInfo } from './components/sms/ConversationInfo';
import { groupMessages } from './lib/messageGrouping';
import { replaceMessageVariables, type MemberWithVisits } from './lib/smsVariables';
import { useSidebar } from './contexts/SidebarContext';

interface SMS {
  id: string;
  direction: 'inbound' | 'outbound';
  message: string;
  created_at: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  sent_at: string | null;
  received_at: string | null;
  is_system?: boolean;
  is_broadcast?: boolean;
  broadcast_recipient_count?: number;
}

interface ThreadInfo {
  phone_number: string;
  member_name: string | null;
  member_id: string | null;
}

export function SMSThread() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const { openSidebar } = useSidebar();
  const [messages, setMessages] = useState<SMS[]>([]);
  const [threadInfo, setThreadInfo] = useState<ThreadInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<MessageInputRef>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [showConversationInfo, setShowConversationInfo] = useState(false);
  const previousMessageCountRef = useRef(0);

  // Group messages using Apple Messages style grouping
  const groupedMessages = useMemo(() => groupMessages(messages), [messages]);

  useEffect(() => {
    if (!threadId) return;

    loadThread();
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
          const newMsg = payload.new as SMS;

          // Don't show system messages
          if (newMsg.is_system) return;

          setMessages(prev => {
            // Check if message already exists (optimistic update)
            const exists = prev.some(msg => msg.id === newMsg.id);
            if (exists) return prev;
            return [...prev, newMsg];
          });
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

  // Auto-scroll on new message if at bottom, otherwise show indicator
  useEffect(() => {
    // Only react to NEW messages, not to isAtBottom changes
    if (messages.length > previousMessageCountRef.current) {
      const lastMessage = messages[messages.length - 1];
      const isOwnMessage = lastMessage.direction === 'outbound';

      if (isOwnMessage) {
        // Always scroll for own messages
        scrollToBottom();
      } else if (isAtBottom) {
        // Scroll for incoming if at bottom
        scrollToBottom();
      } else {
        // Show new message indicator
        setNewMessageCount((prev) => prev + 1);
      }

      previousMessageCountRef.current = messages.length;
    }
  }, [messages, isAtBottom]);

  function scrollToBottom(smooth = true) {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto'
    });
  }

  // Check if user is at bottom
  function handleScroll() {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 100;

    setIsAtBottom(atBottom);
    if (atBottom) {
      setNewMessageCount(0);
    }
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
      const members = data.members as any;
      const info = {
        phone_number: data.phone_number,
        member_id: data.member_id,
        member_name: members ?
          `${members.first_name} ${members.last_name}` :
          null
      };
      setThreadInfo(info);

      // Load messages after we have thread info
      loadMessagesWithInfo(info);
    }
  }

  async function loadMessagesWithInfo(info: ThreadInfo) {
    // Load messages in this thread (individual conversation messages)
    const { data: threadMessages } = await supabase
      .from('sms_queue')
      .select('*')
      .eq('thread_id', threadId)
      .or('is_system.is.null,is_system.eq.false')  // Exclude system messages
      .order('created_at', { ascending: true });

    // Also load broadcast messages sent to this phone number using broadcast_id
    const { data: broadcastMessages } = await supabase
      .from('sms_queue')
      .select('*')
      .eq('phone_number', info.phone_number)
      .eq('direction', 'outbound')
      .not('broadcast_id', 'is', null)
      .or('is_system.is.null,is_system.eq.false')
      .order('created_at', { ascending: true });

    // For each broadcast message, get recipient count from the broadcast
    const messagesWithBroadcastInfo = await Promise.all(
      (broadcastMessages || []).map(async (msg) => {
        if (msg.broadcast_id) {
          // Get the recipient count from the broadcast
          const { data: broadcast } = await supabase
            .from('sms_broadcasts')
            .select('recipient_count')
            .eq('id', msg.broadcast_id)
            .single();

          return {
            ...msg,
            is_broadcast: true,
            broadcast_recipient_count: broadcast?.recipient_count || 1
          };
        }

        return {
          ...msg,
          is_broadcast: true,
          broadcast_recipient_count: 1
        };
      })
    );

    // Combine and sort by time
    const allMessages = [
      ...(threadMessages || []),
      ...messagesWithBroadcastInfo
    ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    setMessages(allMessages);
    setLoading(false);
  }


  async function markAsRead() {
    await supabase
      .from('sms_threads')
      .update({ unread_count: 0 })
      .eq('id', threadId);
  }

  async function sendMessage(messageText: string) {
    if (!messageText.trim() || !threadInfo) return;

    setSending(true);

    try {
      // Get member data for variable replacement if this is a member
      let personalizedMessage = messageText.trim();

      if (threadInfo.member_id) {
        const { data: memberData } = await supabase
          .from('members')
          .select('id, first_name, last_name, visits_last_week, visits_last_3_months, last_visit_at')
          .eq('id', threadInfo.member_id)
          .single();

        if (memberData) {
          const memberWithVisits: MemberWithVisits = {
            id: memberData.id,
            first_name: memberData.first_name,
            last_name: memberData.last_name,
            visits_last_week: memberData.visits_last_week,
            visits_last_3_months: memberData.visits_last_3_months,
            last_visit_at: memberData.last_visit_at
          };

          personalizedMessage = replaceMessageVariables(messageText.trim(), memberWithVisits);
        }
      }

      const { data, error } = await supabase
        .from('sms_queue')
        .insert({
          direction: 'outbound',
          phone_number: threadInfo.phone_number,
          message: personalizedMessage,
          status: 'pending',
          thread_id: threadId
        })
        .select()
        .single();

      if (error) throw error;

      // Optimistically add message to the list immediately
      if (data) {
        setMessages((prev) => [...prev, data as SMS]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Kunde inte skicka meddelandet');
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <MobileContainer>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <div className="w-10 h-10 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
          <p>Laddar konversation...</p>
        </div>
      </MobileContainer>
    );
  }

  return (
    <MobileContainer className="overflow-hidden">
      {/* Thread Header */}
      <ThreadHeader
        contactName={threadInfo?.member_name || ''}
        phoneNumber={threadInfo?.phone_number || ''}
        subtitle={threadInfo?.member_name ? threadInfo.phone_number : undefined}
        onBack={() => navigate('/messages', { state: { animationDirection: 'back' } })}
        onMenu={openSidebar}
        onInfo={() => setShowConversationInfo(true)}
      />

      {/* Messages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
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

      {/* New message indicator */}
      {!isAtBottom && newMessageCount > 0 && (
        <button
          onClick={() => scrollToBottom()}
          className="fixed bottom-[70px] right-5 bg-blue-500 text-white py-2.5 px-5 rounded-[20px] border-none font-semibold text-sm cursor-pointer shadow-lg hover:bg-blue-600 hover:-translate-y-0.5 active:translate-y-0 transition-all z-[100]"
        >
          {newMessageCount} new message{newMessageCount > 1 ? 's' : ''}
        </button>
      )}

      {/* Variable Helper - only show for members */}
      {threadInfo?.member_id && (
        <div className="border-t bg-white px-4 py-3">
          <VariableHelper
            onInsertVariable={(variable) => {
              messageInputRef.current?.insertText(variable);
            }}
          />
        </div>
      )}

      {/* Message Input */}
      <MessageInput
        ref={messageInputRef}
        onSend={(msg) => {
          sendMessage(msg);
        }}
        disabled={sending}
      />

      {/* Conversation Info */}
      {showConversationInfo && threadInfo && (
        <ConversationInfo
          phoneNumber={threadInfo.phone_number}
          memberName={threadInfo.member_name}
          memberId={threadInfo.member_id}
          threadId={threadId!}
          onClose={() => setShowConversationInfo(false)}
          onDelete={() => navigate('/messages', { state: { animationDirection: 'back' } })}
        />
      )}
    </MobileContainer>
  );
}
