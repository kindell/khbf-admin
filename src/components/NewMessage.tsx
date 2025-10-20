import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { MobileContainer } from './layout/MobileContainer';
import { MessageInput } from './sms/MessageInput';
import { useSidebar } from '../contexts/SidebarContext';

interface Recipient {
  id: string; // member_id or phone_number
  name: string;
  phone: string;
  type: 'member' | 'custom';
}

interface Group {
  id: string;
  name: string;
  member_count: number;
  type: 'static' | 'dynamic';
}

export function NewMessage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { openSidebar } = useSidebar();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [sending, setSending] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load groups on mount
  useEffect(() => {
    loadGroups();
  }, []);

  async function loadGroups() {
    const { data, error } = await supabase
      .from('sms_groups')
      .select('id, name, member_count, type')
      .is('deleted_at', null)
      .order('name');

    if (!error && data) {
      setGroups(data);
    }
  }

  // Check for prefilled recipient from navigation state
  useEffect(() => {
    const state = location.state as { prefilledRecipient?: Recipient };
    if (state?.prefilledRecipient) {
      setRecipients([state.prefilledRecipient]);
      // Clear the state to prevent re-adding on navigation
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchMembers();
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  }, [searchQuery]);

  async function searchMembers() {
    const results: any[] = [];

    // Check if it's a phone number (starts with +46 or 0, then digits)
    // Remove spaces, hyphens, and parentheses for validation
    const cleanedQuery = searchQuery.replace(/[\s\-()]/g, '');
    const isPhoneNumber = /^(\+46|0)[0-9]{8,}$/.test(cleanedQuery);

    if (isPhoneNumber) {
      // Format phone number to E.164 format
      let formattedPhone = cleanedQuery;
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '+46' + formattedPhone.substring(1);
      }

      // Show option to add phone number directly
      results.push({
        id: formattedPhone,
        name: formattedPhone,
        phone: formattedPhone,
        type: 'custom'
      });
    }

    // Search for matching groups
    const matchingGroups = groups.filter(group =>
      group.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Add groups to results with 'group' type
    matchingGroups.forEach(group => {
      results.push({
        id: `group-${group.id}`,
        name: group.name,
        groupData: group,
        type: 'group'
      });
    });

    // Use RPC function for efficient full-name search
    const { data, error } = await supabase.rpc('search_members', {
      search_text: searchQuery
    });

    if (error) {
      console.error('Search error:', error);
    } else if (data) {
      // Add member results with proper formatting
      const memberResults = data
        .filter((m: any) => m.phone_number) // Only members with phone numbers
        .map((m: any) => ({
          id: m.member_id,
          name: m.full_name || `${m.first_name || ''} ${m.last_name || ''}`.trim(),
          phone: m.phone_number,
          type: 'member'
        }));
      results.push(...memberResults);
    }

    setSearchResults(results);
    setShowResults(results.length > 0);
  }

  function addRecipient(member: any) {
    // If it's a group, add all group members
    if (member.type === 'group') {
      addGroupMembers(member.groupData);
      setSearchQuery('');
      setSearchResults([]);
      setShowResults(false);
      searchInputRef.current?.focus();
      return;
    }

    const recipient: Recipient = {
      id: member.id,
      name: member.name,
      phone: member.phone,
      type: member.type || 'member'
    };

    // Check if already added
    if (!recipients.some(r => r.id === recipient.id)) {
      setRecipients([...recipients, recipient]);
    }

    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    searchInputRef.current?.focus();
  }

  function removeRecipient(id: string) {
    setRecipients(recipients.filter(r => r.id !== id));
  }

  async function addGroupMembers(group: Group) {
    try {
      console.log('Loading members for group:', group);

      // Get all members from the group
      const { data: groupMembers, error } = await supabase
        .from('sms_group_members')
        .select(`
          member_id,
          member:members!inner (
            id,
            first_name,
            last_name,
            fortnox_customer_number
          )
        `)
        .eq('group_id', group.id);

      if (error) {
        console.error('Error fetching group members:', error);
        throw error;
      }

      console.log('Group members fetched:', groupMembers);

      // Get phone numbers for all members
      const memberIds = groupMembers?.map(gm => gm.member_id) || [];
      console.log('Fetching phone numbers for member IDs:', memberIds);

      const { data: phoneData, error: phoneError } = await supabase
        .from('phone_mappings')
        .select('member_id, phone_number')
        .in('member_id', memberIds)
        .eq('is_primary', true);

      if (phoneError) {
        console.error('Error fetching phone numbers:', phoneError);
      }

      console.log('Phone data fetched:', phoneData);

      // Create phone map
      const phoneMap = new Map<string, string>();
      phoneData?.forEach(p => {
        phoneMap.set(p.member_id, p.phone_number);
      });

      // Convert to recipients and add them
      const newRecipients: Recipient[] = (groupMembers || [])
        .map(gm => {
          const member = Array.isArray(gm.member) ? gm.member[0] : gm.member;
          const phone = phoneMap.get(gm.member_id);

          if (!phone) return null; // Skip members without phone numbers

          return {
            id: gm.member_id,
            name: `${member.first_name} ${member.last_name}`,
            phone: phone,
            type: 'member' as const
          };
        })
        .filter((r): r is Recipient => r !== null);

      // Add new recipients, avoiding duplicates
      const existingIds = new Set(recipients.map(r => r.id));
      const recipientsToAdd = newRecipients.filter(r => !existingIds.has(r.id));

      console.log('New recipients to add:', recipientsToAdd);

      setRecipients([...recipients, ...recipientsToAdd]);

      // Show notification
      if (recipientsToAdd.length > 0) {
        console.log(`✅ Added ${recipientsToAdd.length} members from ${group.name}`);
      } else {
        console.warn('⚠️ No members with phone numbers found in group');
        alert(`Inga medlemmar med telefonnummer hittades i ${group.name}`);
      }
    } catch (error: any) {
      console.error('❌ Error loading group members:', error);
      alert(`Kunde inte ladda gruppmedlemmar: ${error?.message || 'Okänt fel'}`);
    }
  }

  async function handleSend(messageText: string) {
    if (recipients.length === 0 || !messageText.trim()) return;

    setSending(true);

    try {
      if (recipients.length === 1) {
        // Single recipient - create/use conversation thread
        const recipient = recipients[0];

        // Find or create thread
        let { data: thread } = await supabase
          .from('sms_threads')
          .select('id')
          .eq('phone_number', recipient.phone)
          .single();

        // If no thread exists, create one
        if (!thread) {
          const { data: newThread, error: threadError } = await supabase
            .from('sms_threads')
            .insert({
              phone_number: recipient.phone,
              member_id: recipient.type === 'member' ? recipient.id : null,
              last_message_at: new Date().toISOString(),
              last_message_text: messageText.trim(),
              unread_count: 0,
              has_user_messages: true
            })
            .select()
            .single();

          if (threadError) throw threadError;
          thread = newThread;
        }

        // Ensure thread exists
        if (!thread) {
          throw new Error('Failed to create or find thread');
        }

        // Queue the message
        const { error: queueError } = await supabase
          .from('sms_queue')
          .insert({
            direction: 'outbound',
            phone_number: recipient.phone,
            message: messageText.trim(),
            status: 'pending',
            is_system: false,
            thread_id: thread.id
          });

        if (queueError) throw queueError;

        console.log(`✅ Message sent to ${recipient.name}`);
        navigate(`/messages/${thread.id}`, { state: { animationDirection: 'forward' } });
      } else {
        // Multiple recipients - find or create broadcast group
        console.log('📤 Sending to multiple recipients:', recipients.length);
        const recipientPhones = recipients.map(r => r.phone).sort();
        console.log('📱 Recipient phones:', recipientPhones);

        // Find existing broadcast with exact same recipients
        console.log('🔍 Looking for existing broadcast group...');
        const { data: existingBroadcasts, error: searchError } = await supabase
          .from('sms_broadcasts')
          .select(`
            id,
            sms_broadcast_recipients(phone_number)
          `)
          .eq('recipient_count', recipients.length);

        if (searchError) {
          console.error('❌ Error searching broadcasts:', searchError);
          throw searchError;
        }

        console.log('📋 Found broadcasts:', existingBroadcasts?.length || 0);

        let broadcastId: string | null = null;

        // Check if any existing broadcast has exact same recipients
        if (existingBroadcasts) {
          for (const bc of existingBroadcasts) {
            const bcRecipients = bc.sms_broadcast_recipients as any[];
            const bcPhones = bcRecipients.map((r: any) => r.phone_number).sort();

            // Compare arrays
            if (JSON.stringify(bcPhones) === JSON.stringify(recipientPhones)) {
              broadcastId = bc.id;
              console.log('✅ Found existing group:', broadcastId);
              break;
            }
          }
        }

        // If no existing group found, create new broadcast
        if (!broadcastId) {
          console.log('➕ Creating new broadcast group...');
          const { data: newBroadcast, error: broadcastError } = await supabase
            .from('sms_broadcasts')
            .insert({
              message: messageText.trim(),
              recipient_count: recipients.length
            })
            .select()
            .single();

          if (broadcastError) {
            console.error('❌ Error creating broadcast:', broadcastError);
            throw broadcastError;
          }

          broadcastId = newBroadcast.id;
          console.log('✅ Created broadcast:', broadcastId);

          // Create broadcast recipient records for new group
          console.log('👥 Creating recipient records...');
          for (const recipient of recipients) {
            const { error: recipientError } = await supabase
              .from('sms_broadcast_recipients')
              .insert({
                broadcast_id: broadcastId,
                phone_number: recipient.phone,
                member_id: recipient.type === 'member' ? recipient.id : null,
                status: 'pending'
              });

            if (recipientError) {
              console.error('❌ Error creating recipient:', recipientError);
              throw recipientError;
            }
          }
          console.log('✅ Recipient records created');
        } else {
          // Update existing broadcast with latest message
          console.log('🔄 Updating existing broadcast...');
          const { error: updateError } = await supabase
            .from('sms_broadcasts')
            .update({
              message: messageText.trim(),
              sent_at: new Date().toISOString()
            })
            .eq('id', broadcastId);

          if (updateError) {
            console.error('❌ Error updating broadcast:', updateError);
            throw updateError;
          }
          console.log('✅ Broadcast updated');
        }

        // Queue SMS for each recipient
        console.log('📨 Queuing SMS messages...');
        for (const recipient of recipients) {
          console.log('📤 Queuing for:', recipient.phone);
          const { error: queueError } = await supabase
            .from('sms_queue')
            .insert({
              direction: 'outbound',
              phone_number: recipient.phone,
              message: messageText.trim(),
              status: 'pending',
              is_system: false,
              broadcast_id: broadcastId
            });

          if (queueError) {
            console.error('❌ Failed to queue SMS for', recipient.phone, queueError);
            throw queueError;
          }

          console.log('✅ Queued SMS');
        }

        console.log(`✅ All done! Using broadcast group ${broadcastId}`);

        // Reset sending state before navigation
        setSending(false);
        navigate(`/messages/group/${broadcastId}`, { state: { animationDirection: 'forward' } });
      }
    } catch (error) {
      console.error('Failed to send:', error);
      alert('Kunde inte skicka meddelandet');
      setSending(false);
    }
  }

  return (
    <MobileContainer className="bg-white overflow-hidden">
      {/* iPhone-style header matching ThreadHeader */}
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
            Nytt meddelande
          </div>
        </div>

        {/* Right side: Close button (×) */}
        <button
          className="w-8 h-8 rounded-full bg-transparent border-none text-blue-500 flex items-center justify-center cursor-pointer hover:bg-blue-500/10 active:bg-blue-500/20 transition-colors text-[28px] leading-none"
          onClick={() => navigate('/messages', { state: { animationDirection: 'back' } })}
          aria-label="Stäng"
          title="Stäng"
        >
          ×
        </button>
      </div>

      {/* To: field with recipient pills */}
      <div className="relative flex items-start px-4 py-3 border-b border-gray-300 bg-white min-h-14 flex-shrink-0">
        <label className="text-gray-500 text-[17px] pt-1 mr-2 flex-shrink-0">Till:</label>
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-h-8">
          {recipients.map(recipient => (
            <div key={recipient.id} className="inline-flex items-center gap-1 bg-gray-200 rounded-2xl px-3 py-1 text-[15px] max-w-[200px]">
              <span className="whitespace-nowrap overflow-hidden text-ellipsis">{recipient.name}</span>
              <button
                type="button"
                className="bg-black/20 border-none rounded-full w-[18px] h-[18px] flex items-center justify-center cursor-pointer text-xs text-white flex-shrink-0 p-0 leading-none hover:bg-black/30"
                onClick={() => removeRecipient(recipient.id)}
                aria-label="Ta bort mottagare"
              >
                ✕
              </button>
            </div>
          ))}
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            placeholder={recipients.length === 0 ? "Ange namn, telefonnummer eller grupp" : ""}
            className="border-none outline-none text-[17px] flex-1 min-w-[120px] py-1 bg-transparent placeholder:text-gray-400"
            autoFocus
          />
        </div>

        {/* Search results dropdown */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 bg-white border-b border-gray-300 max-h-[300px] overflow-y-auto z-10">
            {searchResults.map(member => (
              <div
                key={member.id}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 active:bg-gray-200 transition-colors"
                onClick={() => addRecipient(member)}
              >
                {member.type === 'group' ? (
                  <>
                    <div className={`
                      w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0
                      ${member.groupData.type === 'static' ? 'bg-blue-100' : 'bg-purple-100'}
                    `}>
                      {member.groupData.type === 'static' ? '👥' : '⚡'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[17px] text-black font-medium">
                        {member.name}
                      </div>
                      <div className="text-[15px] text-gray-500 mt-0.5">
                        {member.groupData.member_count} {member.groupData.member_count === 1 ? 'medlem' : 'medlemmar'}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
                      {member.type === 'custom' ? '📱' : (member.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[17px] text-black">
                        {member.type === 'custom' ? 'Skicka till nummer' : (member.name || 'Okänd')}
                      </div>
                      <div className="text-[15px] text-gray-500 mt-0.5">{member.phone || ''}</div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recipient count indicator */}
      {recipients.length > 0 && (
        <div className="px-4 py-2 text-[13px] text-gray-500 bg-white border-b border-gray-300 text-center flex-shrink-0">
          {recipients.length === 1
            ? '1 mottagare'
            : `${recipients.length} mottagare (gruppmeddelande)`}
        </div>
      )}

      {/* Empty space that fills remaining height */}
      <div className="flex-1 bg-white overflow-hidden">
        {recipients.length === 0 && (
          <div className="flex items-center justify-center h-full px-5">
            <p className="text-gray-400 text-[17px] text-center">
              Lägg till mottagare för att skicka ett meddelande
            </p>
          </div>
        )}
      </div>

      {/* Message Input - always at bottom */}
      {recipients.length > 0 && (
        <MessageInput
          onSend={handleSend}
          disabled={sending}
        />
      )}
    </MobileContainer>
  );
}
