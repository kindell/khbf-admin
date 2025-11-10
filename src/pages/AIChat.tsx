import { useState, useEffect, useRef } from 'react';
import { supabase, type Member } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { Send, Trash2, Bot, User as UserIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

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
  const [session, setSession] = useState<{ memberId: string; email: string } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [currentThread, setCurrentThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

    // Auto-select current logged in user if available
    if (session && data) {
      const currentMember = data.find((m: any) => m.id === session.memberId);
      if (currentMember) {
        setSelectedMemberId(currentMember.id);
        loadOrCreateThread(currentMember.id);
      }
    }
  }

  async function loadOrCreateThread(memberId: string) {
    if (!session) return;

    setLoading(true);

    // Try to find existing thread
    const { data: existingThread } = await supabase
      .from('admin_chat_threads')
      .select('*')
      .eq('admin_user_id', session.email)
      .eq('impersonating_member_id', memberId)
      .single();

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
    setSelectedMemberId(memberId);
    loadOrCreateThread(memberId);
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
          {/* Member Selector */}
          <div className="mb-4 flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm text-muted-foreground mb-2 block">
                Prata som:
              </label>
              <Select value={selectedMemberId} onChange={(e) => handleMemberChange(e.target.value)}>
                <option value="">Välj medlem...</option>
                {members.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.first_name} {member.last_name}
                  </option>
                ))}
              </Select>
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

                        {/* Debug info - show function calls if available */}
                        {msg.function_calls && (
                          <details className="mt-2 text-xs">
                            <summary className="cursor-pointer text-muted-foreground">
                              Debug: Function Calls
                            </summary>
                            <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto">
                              {JSON.stringify(msg.function_calls, null, 2)}
                            </pre>
                          </details>
                        )}
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
