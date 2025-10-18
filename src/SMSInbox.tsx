import { useEffect, useState, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { useNavigate } from 'react-router-dom';
import { ConversationItem } from './components/sms/ConversationItem';
import { SearchBar } from './components/search/SearchBar';
import { SearchResults } from './components/search/SearchResults';
import { MobileContainer } from './components/layout/MobileContainer';
import { useSidebar } from './contexts/SidebarContext';
import './SMSInbox.css';
import './components/search/SearchBar.css';

interface Thread {
  id: string;
  phone_number: string;
  member_id: string | null;
  member_name: string | null;
  last_message_at: string;
  last_message_text: string;
  unread_count: number;
}

interface Broadcast {
  id: string;
  message: string;
  recipient_count: number;
  sent_at: string;
  name?: string | null;
}

type InboxItem =
  | { type: 'thread'; data: Thread }
  | { type: 'broadcast'; data: Broadcast };


interface SMSInboxProps {
  adminMemberId?: string;
  adminMemberName?: string;
}

export function SMSInbox(_props: SMSInboxProps) {
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();
  const { openSidebar } = useSidebar();

  useEffect(() => {
    loadInboxItems();

    // Realtime updates for threads
    const threadsSubscription = supabase
      .channel('sms_threads_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'sms_threads' },
        () => loadInboxItems()
      )
      .subscribe();

    // Realtime updates for broadcasts
    const broadcastsSubscription = supabase
      .channel('broadcasts_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'sms_broadcasts' },
        () => loadInboxItems()
      )
      .subscribe();

    return () => {
      threadsSubscription.unsubscribe();
      broadcastsSubscription.unsubscribe();
    };
  }, []);

  async function loadInboxItems() {
    // Load threads (only those with user messages, not system messages)
    const { data: threadsData, error: threadsError } = await supabase
      .from('sms_threads')
      .select(`
        *,
        members:member_id (
          first_name,
          last_name
        )
      `)
      .eq('has_user_messages', true)
      .order('last_message_at', { ascending: false });

    // Load broadcasts
    const { data: broadcastsData, error: broadcastsError } = await supabase
      .from('sms_broadcasts')
      .select('*')
      .order('sent_at', { ascending: false });

    if (threadsError) {
      console.error('Failed to load threads:', threadsError);
    }

    if (broadcastsError) {
      console.error('Failed to load broadcasts:', broadcastsError);
    }

    // Combine and sort by time
    const items: InboxItem[] = [];

    if (threadsData) {
      threadsData.forEach(t => {
        items.push({
          type: 'thread',
          data: {
            ...t,
            member_name: t.members ?
              `${t.members.first_name} ${t.members.last_name}` :
              null
          }
        });
      });
    }

    if (broadcastsData) {
      broadcastsData.forEach(b => {
        items.push({
          type: 'broadcast',
          data: b
        });
      });
    }

    // Sort by time (most recent first)
    items.sort((a, b) => {
      const timeA = a.type === 'thread' ? a.data.last_message_at : a.data.sent_at;
      const timeB = b.type === 'thread' ? b.data.last_message_at : b.data.sent_at;
      return new Date(timeB).getTime() - new Date(timeA).getTime();
    });

    setInboxItems(items);
    setLoading(false);
  }

  // formatTime function removed - now using ConversationItem component which has its own formatting

  const handleSearch = useCallback(async (query: string) => {
    // Only show loading after 200ms - prevents flicker for fast searches
    const loadingTimeout = setTimeout(() => {
      setIsSearching(true);
    }, 200);

    try {
      // Search in SMS messages (exclude system messages)
      const { data, error } = await supabase
        .from('sms_queue')
        .select(`
          id,
          message,
          created_at,
          thread_id,
          sms_threads!inner (
            phone_number,
            member_id,
            members (
              first_name,
              last_name
            )
          )
        `)
        .eq('is_system', false)
        .ilike('message', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Format results
      const formattedResults = data?.map((item: any) => ({
        messageId: item.id,
        messageText: item.message,
        createdAt: item.created_at,
        conversationId: item.thread_id,
        contactName: item.sms_threads.members
          ? `${item.sms_threads.members.first_name} ${item.sms_threads.members.last_name}`
          : null,
        phoneNumber: item.sms_threads.phone_number
      })) || [];

      // Update query and results together to avoid rendering SearchResults with empty results
      setSearchQuery(query);
      setSearchResults(formattedResults);
    } catch (error) {
      console.error('❌ Search failed:', error);
      setSearchQuery(query);
      setSearchResults([]);
    } finally {
      clearTimeout(loadingTimeout);
      setIsSearching(false);
    }
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
  }, []);

  const handleResultClick = useCallback((result: any) => {
    // Navigate to the conversation thread
    navigate(`/messages/${result.conversationId}`, { state: { animationDirection: 'forward' } });
  }, [navigate]);

  return (
    <MobileContainer className="overflow-hidden">
      {/* Header matching ThreadHeader style */}
      <div className="z-10 h-auto py-3 px-4 pb-4 flex items-center justify-between bg-white/80 backdrop-blur-xl border-b border-black/10 w-full box-border flex-shrink-0">
        {/* Left side: Menu button (hidden on desktop) */}
        <button
          className="p-2 -ml-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors lg:invisible"
          onClick={openSidebar}
          aria-label="Öppna meny"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-gray-700">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Center: Title */}
        <div className="absolute left-1/2 -translate-x-1/2 text-center max-w-[45%]">
          <div className="text-[17px] font-semibold text-black whitespace-nowrap overflow-hidden text-ellipsis">
            📱 Meddelanden
          </div>
        </div>

        {/* Right side: New message button */}
        <button
          className="w-8 h-8 rounded-full bg-transparent border-none text-blue-500 flex items-center justify-center cursor-pointer hover:bg-blue-500/10 active:bg-blue-500/20 transition-colors text-[28px] leading-none"
          onClick={() => navigate('/messages/new', { state: { animationDirection: 'forward' } })}
          aria-label="Nytt meddelande"
          title="Nytt meddelande"
        >
          +
        </button>
      </div>

      {/* Search Bar */}
      <SearchBar
        onSearch={handleSearch}
        onClear={handleClearSearch}
        placeholder="Search"
      />

      {/* Unified inbox content */}
      {searchQuery ? (
        // Show search results when searching
        isSearching ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Söker...</p>
          </div>
        ) : (
          <SearchResults
            results={searchResults}
            query={searchQuery}
            onResultClick={handleResultClick}
          />
        )
      ) : loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Laddar meddelanden...</p>
        </div>
      ) : inboxItems.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💬</div>
          <h2>Inga meddelanden än</h2>
          <p>Skickade och mottagna meddelanden visas här</p>
        </div>
      ) : (
        <div className="thread-list">
          {inboxItems.map(item => (
            <ConversationItem
              key={item.data.id}
              item={item}
              onClick={() => {
                if (item.type === 'thread') {
                  navigate(`/messages/${item.data.id}`, { state: { animationDirection: 'forward' } });
                } else {
                  navigate(`/messages/group/${item.data.id}`, { state: { animationDirection: 'forward' } });
                }
              }}
            />
          ))}
        </div>
      )}
    </MobileContainer>
  );
}
