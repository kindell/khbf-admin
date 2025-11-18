import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Input } from '../components/ui/input';
import { Send, Trash2, Bot, User } from 'lucide-react';
import { MobileContainer } from '../components/layout/MobileContainer';
import { ChatBubble } from '../components/chat/ChatBubble';
import { useSidebar } from '../contexts/SidebarContext';

interface ChatMember {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  status: string;
}

interface ChatMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  message: string;
  is_ai: boolean | null;
  created_at: string;
  function_calls?: any;
  context_used?: any;
}

interface ChatThread {
  id: string;
  impersonating_member_id: string;
  created_at: string;
}

export default function AIChat() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [session, setSession] = useState<{ memberId: string; email: string } | null>(null);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [currentThread, setCurrentThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [memberMessageCounts, setMemberMessageCounts] = useState<Record<string, number>>({});
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [showMemberSelector, setShowMemberSelector] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastLoggedMessageId = useRef<string | null>(null);
  const { openSidebar } = useSidebar();

  // Get selected member ID from URL
  const selectedMemberId = searchParams.get('member') || '';

  // Filter members based on search
  const filteredMembers = members
    .filter(m =>
      `${m.first_name} ${m.last_name}`.toLowerCase().includes(memberSearch.toLowerCase())
    )
    .sort((a, b) => {
      // Sort by: members with message history first, then alphabetically
      const aHasHistory = (memberMessageCounts[a.id] || 0) > 0;
      const bHasHistory = (memberMessageCounts[b.id] || 0) > 0;

      if (aHasHistory && !bHasHistory) return -1;
      if (!aHasHistory && bHasHistory) return 1;

      // Both have history or both don't - sort alphabetically
      return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
    });

  // Get selected member from members list
  const selectedMember = members.find(m => m.id === selectedMemberId);

  // Get initials from member name
  const getInitials = (firstName: string, lastName: string): string => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  // Get initials for chat bubbles
  const userInitials = selectedMember
    ? getInitials(selectedMember.first_name, selectedMember.last_name)
    : undefined;

  // Get current user session
  useEffect(() => {
    const savedSession = localStorage.getItem('khbf_admin_session');
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        // Use member ID as the stable admin_user_id (more consistent than phone/name)
        const sessionData = {
          memberId: parsed.memberId,
          email: parsed.memberId  // Changed: use memberId instead of phone/name for consistency
        };
        console.log('🔐 AI Chat Session:', sessionData);
        setSession(sessionData);
      } catch (error) {
        console.error('Failed to parse session:', error);
      }
    }
  }, []);

  // Load current user's member info immediately on session load
  useEffect(() => {
    console.log('📋 Check auto-load:', { session: !!session, selectedMemberId });
    if (session) {
      console.log('⚡ Loading current member...');
      loadCurrentMember();
    }
  }, [session]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Log new AI messages with metadata to console (only once per message)
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.direction === 'outbound' && lastMessage.is_ai) {
      // Only log if this is a new message we haven't logged yet
      if (lastMessage.id !== lastLoggedMessageId.current) {
        if (lastMessage.function_calls || lastMessage.context_used) {
          console.group(`🤖 AI Response: "${lastMessage.message.substring(0, 50)}..."`);

          if (lastMessage.function_calls) {
            console.log('📞 Function Calls:', lastMessage.function_calls);
          }

          if (lastMessage.context_used) {
            console.log('📊 Context Used:', lastMessage.context_used);
          }

          console.log('💬 Full Message:', lastMessage.message);
          console.groupEnd();
        }
        lastLoggedMessageId.current = lastMessage.id;
      }
    }
  }, [messages]);

  // Update page title based on selected member
  useEffect(() => {
    if (selectedMember) {
      document.title = `AI Chat - ${selectedMember.first_name} ${selectedMember.last_name} | KHbf Admin`;
    } else {
      document.title = 'AI Chat | KHbf Admin';
    }

    // Cleanup: reset title when component unmounts
    return () => {
      document.title = 'KHbf Admin';
    };
  }, [selectedMember]);

  // Load thread when selected member changes (from URL)
  useEffect(() => {
    if (selectedMemberId && session) {
      loadOrCreateThread(selectedMemberId);
    }
  }, [selectedMemberId, session]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!currentThread) return;

    const subscription = supabase
      .channel(`admin_chat_${currentThread.id}`)
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admin_chat_messages',
          filter: `thread_id=eq.${currentThread.id}`
        },
        () => loadMessages()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentThread]);

  async function loadCurrentMember() {
    if (!session) return;

    console.log('👤 Loading current member:', session.memberId);

    // Load only the current user's member info
    const { data, error } = await supabase
      .from('members')
      .select('id, first_name, last_name, phone, status')
      .eq('id', session.memberId)
      .eq('status', 'MEDLEM')
      .single();

    if (error) {
      console.error('Failed to load current member:', error);
      return;
    }

    if (data) {
      console.log('✅ Loaded member:', data.first_name, data.last_name);
      // Set only this member in the list
      setMembers([data]);
      // Auto-select this member if not already selected
      if (!selectedMemberId) {
        setSearchParams({ member: data.id });
      }
    }
  }

  async function loadMembers() {
    if (membersLoaded) return; // Already loaded

    const { data, error } = await supabase
      .from('members')
      .select('id, first_name, last_name, phone, status')
      .eq('status', 'MEDLEM')
      .order('first_name');

    if (error) {
      console.error('Failed to load members:', error);
      return;
    }

    setMembers(data || []);
    setMembersLoaded(true);

    // Load message counts only for members who have threads
    if (session && data) {
      await loadMessageCounts();
    }
  }

  async function loadMessageCounts() {
    if (!session) return;

    // Get all threads for this admin
    const { data: threads } = await supabase
      .from('admin_chat_threads')
      .select('id, impersonating_member_id')
      .eq('admin_user_id', session.email);

    if (!threads || threads.length === 0) return;

    // Fetch message counts in parallel using Promise.all
    const countPromises = threads.map(thread =>
      supabase
        .from('admin_chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('thread_id', thread.id)
        .then(({ count }) => ({ memberId: thread.impersonating_member_id, count }))
    );

    const results = await Promise.all(countPromises);

    // Build counts object
    const counts: Record<string, number> = {};
    results.forEach(({ memberId, count }) => {
      if (count && count > 0) {
        counts[memberId] = count;
      }
    });

    setMemberMessageCounts(counts);
  }

  async function loadOrCreateThread(memberId: string) {
    if (!session) return;

    setLoading(true);

    console.log('🔍 Looking for thread:', { admin_user_id: session.email, impersonating_member_id: memberId });

    // Try to find existing thread with current admin_user_id (memberId)
    let { data: existingThread } = await supabase
      .from('admin_chat_threads')
      .select('id, admin_user_id, impersonating_member_id, created_at, updated_at')
      .eq('admin_user_id', session.email)
      .eq('impersonating_member_id', memberId)
      .maybeSingle();

    // If not found, try to find ANY thread where this admin is impersonating this member
    // (handles old threads created with different admin_user_id like phone number)
    if (!existingThread) {
      console.log('🔄 No thread found with current admin_user_id, searching for any existing threads...');
      const { data: anyThread } = await supabase
        .from('admin_chat_threads')
        .select('id, admin_user_id, impersonating_member_id, created_at, updated_at')
        .eq('impersonating_member_id', memberId)
        .limit(1)
        .maybeSingle();

      if (anyThread) {
        console.log('✅ Found old thread, migrating admin_user_id to:', session.email);
        // Update the old thread to use the new admin_user_id
        await supabase
          .from('admin_chat_threads')
          .update({ admin_user_id: session.email })
          .eq('id', anyThread.id);

        existingThread = { ...anyThread, admin_user_id: session.email };
      }
    }

    if (existingThread) {
      console.log('✅ Found existing thread:', existingThread.id);
      setCurrentThread(existingThread);
      await loadMessages(existingThread.id);
    } else {
      console.log('➕ Creating new thread...');
      // Create new thread
      const { data: newThread, error } = await supabase
        .from('admin_chat_threads')
        .insert({
          admin_user_id: session.email,
          impersonating_member_id: memberId
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create thread:', error);
        setLoading(false);
        return;
      }

      console.log('✅ Created new thread:', newThread.id);
      setCurrentThread(newThread);
      setMessages([]);
    }

    setLoading(false);
  }

  async function loadMessages(threadId?: string) {
    const id = threadId || currentThread?.id;
    if (!id) return;

    console.log('💬 Loading messages for thread:', id);

    const { data, error, count } = await supabase
      .from('admin_chat_messages')
      .select('*', { count: 'exact' })
      .eq('thread_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to load messages:', error);
      return;
    }

    console.log(`✅ Loaded ${data?.length || 0} messages (DB reports ${count} total)`);
    if (data && data.length > 0) {
      console.log('First message:', data[0]);
    }
    setMessages(data || []);
  }

  async function handleSendMessage() {
    if (!inputMessage.trim() || !currentThread || !session) return;

    setLoading(true);

    // Insert user message
    const { error } = await supabase
      .from('admin_chat_messages')
      .insert({
        thread_id: currentThread.id,
        direction: 'inbound',
        message: inputMessage,
        is_ai: false
      });

    if (error) {
      console.error('Failed to send message:', error);
      setLoading(false);
      return;
    }

    setInputMessage('');
    setLoading(false);

    // Messages will be updated via realtime subscription
    // AI will process and respond automatically
  }

  async function handleClearThread() {
    if (!currentThread) return;
    if (!confirm('Är du säker på att du vill rensa denna konversation?')) return;

    const { error } = await supabase
      .from('admin_chat_messages')
      .delete()
      .eq('thread_id', currentThread.id);

    if (error) {
      console.error('Failed to clear thread:', error);
      return;
    }

    setMessages([]);

    // Update message count for this member
    if (selectedMemberId) {
      setMemberMessageCounts(prev => {
        const updated = { ...prev };
        delete updated[selectedMemberId];
        return updated;
      });
    }
  }

  function handleMemberChange(memberId: string) {
    // Update URL with selected member
    if (memberId) {
      setSearchParams({ member: memberId });
    } else {
      setSearchParams({});
    }
  }

  return (
    <MobileContainer className="overflow-hidden">
      {/* Custom Header */}
      <div className="z-10 h-auto py-3 px-4 pb-4 flex items-center justify-between bg-card/80 backdrop-blur-xl border-b border-border/30 w-full box-border flex-shrink-0">
        {/* Menu button */}
        <button
          className="p-2 -ml-2 hover:bg-accent active:bg-accent/80 rounded-lg transition-colors lg:invisible"
          onClick={openSidebar}
          aria-label="Öppna meny"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-foreground">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Center title */}
        <div className="absolute left-1/2 -translate-x-1/2 text-center">
          <div className="text-[17px] font-semibold text-foreground flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Chat
          </div>
        </div>

        {/* Right buttons */}
        {messages.length > 0 && (
          <button
            className="p-2 hover:bg-accent active:bg-accent/80 rounded-lg transition-colors"
            onClick={handleClearThread}
            aria-label="Rensa konversation"
          >
            <Trash2 className="w-5 h-5 text-foreground" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-background w-full">
        <div className="py-4 px-4 w-full box-border">
          {/* Chat Messages */}
          {selectedMember ? (
            <>
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <Bot className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Inga meddelanden än. Ställ en fråga för att börja!</p>
                </div>
              ) : (
                messages.map(msg => (
                  <ChatBubble
                    key={msg.id}
                    message={msg.message}
                    direction={msg.direction}
                    timestamp={msg.created_at}
                    isAI={msg.is_ai || false}
                    userInitials={userInitials}
                    botInitials={undefined}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </>
          ) : (
            <div className="text-center text-muted-foreground py-12">
              <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Välj en medlem för att börja chatta</p>
            </div>
          )}
        </div>
      </div>

      {/* Input with member selector */}
      <div className="bg-card border-t border-border/30 min-h-[72px] p-4 w-full box-border z-10 flex-shrink-0">
        {/* Member Selector Drop-up */}
        {showMemberSelector && (
          <div className="absolute bottom-[72px] left-4 right-4 bg-card border border-border/30 rounded-lg shadow-lg max-h-60 overflow-hidden mb-2">
            <div className="p-3 border-b border-border/30 bg-muted/30">
              <Input
                ref={searchInputRef}
                type="text"
                value={selectedMember ? `${selectedMember.first_name} ${selectedMember.last_name}` : memberSearch}
                onChange={(e) => {
                  if (!membersLoaded) {
                    loadMembers();
                  }
                  if (selectedMember) {
                    setSearchParams({});
                  }
                  setMemberSearch(e.target.value);
                  setShowSuggestions(true);
                  setSelectedSuggestionIndex(0);
                }}
                onKeyDown={(e) => {
                  if (!showSuggestions || filteredMembers.length === 0) return;

                  const visibleMembers = filteredMembers.slice(0, 10);

                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedSuggestionIndex(prev =>
                      prev < visibleMembers.length - 1 ? prev + 1 : prev
                    );
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : 0);
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const selectedMember = visibleMembers[selectedSuggestionIndex];
                    if (selectedMember) {
                      handleMemberChange(selectedMember.id);
                      setMemberSearch('');
                      setShowSuggestions(false);
                      setSelectedSuggestionIndex(0);
                      setShowMemberSelector(false);
                    }
                  } else if (e.key === 'Escape') {
                    setShowMemberSelector(false);
                  }
                }}
                placeholder="Sök medlem..."
                autoComplete="off"
                autoFocus
                className="text-sm"
              />
            </div>
            {showSuggestions && filteredMembers.length > 0 && (
              <div className="overflow-y-auto max-h-48">
                {filteredMembers.slice(0, 10).map((member, index) => {
                  const messageCount = memberMessageCounts[member.id] || 0;
                  return (
                    <button
                      key={member.id}
                      onClick={() => {
                        handleMemberChange(member.id);
                        setMemberSearch('');
                        setShowSuggestions(false);
                        setSelectedSuggestionIndex(0);
                        setShowMemberSelector(false);
                      }}
                      className={`w-full text-left px-3 py-2 transition-colors flex items-center justify-between ${
                        index === selectedSuggestionIndex
                          ? 'bg-accent'
                          : 'hover:bg-accent'
                      }`}
                    >
                      <span>{member.first_name} {member.last_name}</span>
                      {messageCount > 0 && (
                        <span className="text-sm text-muted-foreground">
                          {messageCount} {messageCount === 1 ? 'meddelande' : 'meddelanden'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-end gap-2"
        >
          {/* Member selector button */}
          <button
            type="button"
            onClick={() => {
              if (!membersLoaded) {
                loadMembers();
              }
              setShowMemberSelector(!showMemberSelector);
              setShowSuggestions(true);
            }}
            className={`w-9 h-9 min-w-[36px] min-h-[36px] rounded-full border border-border/30 flex items-center justify-center transition-all flex-shrink-0 ${
              selectedMember
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
            aria-label="Välj medlem"
          >
            {selectedMember ? (
              <span className="text-xs font-semibold">
                {getInitials(selectedMember.first_name, selectedMember.last_name)}
              </span>
            ) : (
              <User className="w-4 h-4" />
            )}
          </button>

          {/* Input */}
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !loading && inputMessage.trim() && selectedMember) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={selectedMember ? `Skriv som ${selectedMember.first_name}...` : 'Välj medlem först...'}
            disabled={loading || !selectedMember}
            className="flex-1 resize-none py-2 px-3 border border-border/30 rounded-[20px] text-[17px] leading-[22px] text-foreground bg-card outline-none min-h-[36px] transition-colors focus:border-primary disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed placeholder:text-muted-foreground"
          />

          {/* Send button */}
          <button
            type="submit"
            disabled={loading || !inputMessage.trim() || !selectedMember}
            className={`w-9 h-9 min-w-[36px] min-h-[36px] rounded-full border-none flex items-center justify-center transition-all flex-shrink-0 bg-blue-500 text-white ${
              loading || !inputMessage.trim() || !selectedMember
                ? 'opacity-40 cursor-not-allowed'
                : 'cursor-pointer hover:bg-blue-600 hover:scale-105 active:bg-blue-700 active:scale-95'
            }`}
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </MobileContainer>
  );
}
