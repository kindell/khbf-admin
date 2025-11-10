import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Send, Trash2, Bot, User as UserIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get selected member ID from URL
  const selectedMemberId = searchParams.get('member') || '';

  // Filter members based on search
  const filteredMembers = members.filter(m =>
    `${m.first_name} ${m.last_name}`.toLowerCase().includes(memberSearch.toLowerCase())
  );

  // Get current user session
  useEffect(() => {
    const savedSession = localStorage.getItem('khbf_admin_session');
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        // Use member's primary phone or email as user ID
        setSession({
          memberId: parsed.memberId,
          email: parsed.phoneNumber || parsed.memberName
        });
      } catch (error) {
        console.error('Failed to parse session:', error);
      }
    }
  }, []);

  // Load members - wait for session to be available
  useEffect(() => {
    if (session) {
      loadMembers();
    }
  }, [session]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Log new AI messages with metadata to console
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.direction === 'outbound' && lastMessage.is_ai) {
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

  async function loadMembers() {
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

    // Load message counts for all members
    if (session && data) {
      await loadMessageCounts();
    }

    // Auto-select current logged in user if no member selected in URL
    if (session && data && !selectedMemberId) {
      const currentMember = data.find((m: any) => m.id === session.memberId);
      if (currentMember) {
        setSearchParams({ member: currentMember.id });
      }
    }
  }

  async function loadMessageCounts() {
    if (!session) return;

    // Instead of querying all at once (URL too long), just get all threads for this admin
    // without filtering by member IDs
    const { data: threads } = await supabase
      .from('admin_chat_threads')
      .select('id, impersonating_member_id')
      .eq('admin_user_id', session.email);

    if (!threads) return;

    // Get message counts for each thread
    const counts: Record<string, number> = {};
    for (const thread of threads) {
      const { count } = await supabase
        .from('admin_chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('thread_id', thread.id);

      if (count) {
        counts[thread.impersonating_member_id] = count;
      }
    }

    setMemberMessageCounts(counts);
  }

  async function loadOrCreateThread(memberId: string) {
    if (!session) return;

    setLoading(true);

    // Try to find existing thread
    const { data: existingThread } = await supabase
      .from('admin_chat_threads')
      .select('id, admin_user_id, impersonating_member_id, created_at, updated_at')
      .eq('admin_user_id', session.email)
      .eq('impersonating_member_id', memberId)
      .maybeSingle();

    if (existingThread) {
      setCurrentThread(existingThread);
      await loadMessages(existingThread.id);
    } else {
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

      setCurrentThread(newThread);
      setMessages([]);
    }

    setLoading(false);
  }

  async function loadMessages(threadId?: string) {
    const id = threadId || currentThread?.id;
    if (!id) return;

    const { data, error } = await supabase
      .from('admin_chat_messages')
      .select('*')
      .eq('thread_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to load messages:', error);
      return;
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
  }

  function handleMemberChange(memberId: string) {
    // Update URL with selected member
    if (memberId) {
      setSearchParams({ member: memberId });
    } else {
      setSearchParams({});
    }
  }

  const selectedMember = members.find(m => m.id === selectedMemberId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            AI Chat
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Member Selector with Autosuggest */}
          <div className="mb-4 flex items-end gap-4">
            <div className="flex-1 relative">
              <label className="text-sm text-muted-foreground mb-2 block">
                Prata som:
              </label>
              <Input
                ref={searchInputRef}
                type="text"
                value={selectedMember ? `${selectedMember.first_name} ${selectedMember.last_name}` : memberSearch}
                onChange={(e) => {
                  // Clear selected member when user starts typing
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
                    }
                  } else if (e.key === 'Escape') {
                    setShowSuggestions(false);
                  }
                }}
                onFocus={(e) => {
                  setShowSuggestions(true);
                  setSelectedSuggestionIndex(0);
                  // Select all text when focusing on a selected member
                  if (selectedMember) {
                    e.target.select();
                  }
                }}
                onBlur={() => {
                  // Delay to allow click on suggestion
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                placeholder="Sök medlem..."
                autoComplete="off"
              />

              {/* Suggestions Dropdown */}
              {showSuggestions && memberSearch && filteredMembers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
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

            {messages.length > 0 && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleClearThread}
                title="Rensa konversation"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Chat Window */}
          {selectedMember && (
            <div className="border rounded-lg bg-background">
              {/* Messages */}
              <div className="h-[500px] overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <Bot className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Inga meddelanden än. Ställ en fråga för att börja!</p>
                  </div>
                ) : (
                  messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${msg.direction === 'inbound' ? 'flex-row' : 'flex-row-reverse'}`}
                    >
                      {/* Avatar */}
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        msg.direction === 'inbound'
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-green-100 text-green-600'
                      }`}>
                        {msg.direction === 'inbound' ? (
                          <UserIcon className="w-5 h-5" />
                        ) : (
                          <Bot className="w-5 h-5" />
                        )}
                      </div>

                      {/* Message Bubble */}
                      <div className={`flex-1 max-w-[80%] ${msg.direction === 'outbound' ? 'text-right' : ''}`}>
                        <div
                          className={`inline-block rounded-lg px-4 py-2 ${
                            msg.direction === 'inbound'
                              ? 'bg-blue-100 text-blue-900'
                              : 'bg-green-100 text-green-900'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.message}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(msg.created_at), {
                            addSuffix: true,
                            locale: sv
                          })}
                        </p>

                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t p-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex gap-2"
                >
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && !loading && inputMessage.trim()) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={`Skriv som ${selectedMember.first_name}...`}
                    disabled={loading}
                    autoFocus
                  />
                  <Button type="submit" disabled={loading || !inputMessage.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
