import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { MobileContainer } from './layout/MobileContainer';
import { MessageInput, type MessageInputRef } from './sms/MessageInput';
import { VariableHelper } from './sms/VariableHelper';
import { replaceMessageVariables, type MemberWithVisits } from '../lib/smsVariables';
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

interface SelectedGroupBubble {
  id: string;
  name: string;
  member_count: number;
  type: 'static' | 'dynamic';
  memberIds: string[]; // Store resolved member IDs
}

export function NewMessage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { openSidebar } = useSidebar();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [sending, setSending] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupBubbles, setSelectedGroupBubbles] = useState<SelectedGroupBubble[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<MessageInputRef>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const resultRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hasLoadedFromQuery = useRef(false);

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

  // Check for group query parameter and auto-load it
  useEffect(() => {
    const groupId = searchParams.get('group');
    if (groupId && groups.length > 0 && !hasLoadedFromQuery.current) {
      const group = groups.find(g => g.id === groupId);
      if (group) {
        hasLoadedFromQuery.current = true;
        loadGroupAsBubble(group);
      }
    }
  }, [searchParams, groups]); // Re-run when groups are loaded or searchParams change

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchMembers();
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  }, [searchQuery]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchResults]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultRefs.current[selectedIndex]) {
      resultRefs.current[selectedIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedIndex]);

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
    // If it's a group, show as bubble and load members in background
    if (member.type === 'group') {
      loadGroupAsBubble(member.groupData);
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

  function removeGroupBubble(groupId: string) {
    setSelectedGroupBubbles(selectedGroupBubbles.filter(g => g.id !== groupId));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showResults || searchResults.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < searchResults.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (searchResults[selectedIndex]) {
          addRecipient(searchResults[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowResults(false);
        break;
    }
  }

  async function loadGroupAsBubble(group: Group) {
    try {
      console.log('Loading group as bubble:', group);

      // Check if group is already selected
      if (selectedGroupBubbles.some(g => g.id === group.id)) {
        console.log('⚠️ Group already selected');
        return;
      }

      // Get member IDs for this group
      const memberIds = await resolveGroupMemberIds(group);

      // Create bubble with member IDs
      const newBubble: SelectedGroupBubble = {
        id: group.id,
        name: group.name,
        member_count: memberIds.length,
        type: group.type,
        memberIds: memberIds
      };

      setSelectedGroupBubbles([...selectedGroupBubbles, newBubble]);

      console.log(`✅ Group bubble created with ${memberIds.length} members`);
    } catch (error: any) {
      console.error('❌ Error loading group bubble:', error);
      alert(`Kunde inte ladda grupp: ${error?.message || 'Okänt fel'}`);
    }
  }

  // Legacy function - currently unused but kept for potential future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
    // @ts-expect-error - Declared but not used yet
  async function sendToGroupBubble(messageText: string, groupBubble: SelectedGroupBubble) {
    try {
      console.log('📤 Sending to group bubble:', groupBubble);

      // Get full recipient data with phone numbers and visit data for variables
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select(`
          id,
          first_name,
          last_name,
          visits_last_week,
          visits_last_3_months,
          last_visit_at
        `)
        .in('id', groupBubble.memberIds);

      if (membersError) throw membersError;

      // Get phone numbers
      const { data: phoneData, error: phoneError } = await supabase
        .from('phone_mappings')
        .select('member_id, phone_number')
        .in('member_id', groupBubble.memberIds)
        .eq('is_primary', true);

      if (phoneError) throw phoneError;

      // Create phone map
      const phoneMap = new Map<string, string>();
      phoneData?.forEach(p => {
        phoneMap.set(p.member_id, p.phone_number);
      });

      // Create member data map for variable replacement
      const memberDataMap = new Map<string, MemberWithVisits>();
      membersData?.forEach(m => {
        memberDataMap.set(m.id, {
          id: m.id,
          first_name: m.first_name,
          last_name: m.last_name,
          visits_last_week: m.visits_last_week,
          visits_last_3_months: m.visits_last_3_months,
          last_visit_at: m.last_visit_at
        });
      });

      // Build recipients list
      const groupRecipients: Recipient[] = (membersData || [])
        .filter(m => phoneMap.has(m.id))
        .map(m => ({
          id: m.id,
          name: `${m.first_name} ${m.last_name}`,
          phone: phoneMap.get(m.id)!,
          type: 'member' as const
        }));

      console.log(`📱 ${groupRecipients.length} recipients with phone numbers`);

      // Create broadcast name with timestamp for dynamic groups
      let broadcastName = groupBubble.name;
      if (groupBubble.type === 'dynamic') {
        const now = new Date();
        const timestamp = now.toLocaleString('sv-SE', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }).replace(',', '');
        broadcastName = `${broadcastName} (${timestamp})`;
      }

      // Create broadcast
      const { data: newBroadcast, error: broadcastError } = await supabase
        .from('sms_broadcasts')
        .insert({
          message: messageText.trim(),
          recipient_count: groupRecipients.length,
          name: broadcastName
        })
        .select()
        .single();

      if (broadcastError) throw broadcastError;

      const broadcastId = newBroadcast.id;
      console.log('✅ Created broadcast:', broadcastId);

      // Create broadcast recipient records
      for (const recipient of groupRecipients) {
        const { error: recipientError } = await supabase
          .from('sms_broadcast_recipients')
          .insert({
            broadcast_id: broadcastId,
            phone_number: recipient.phone,
            member_id: recipient.id,
            status: 'pending'
          });

        if (recipientError) throw recipientError;
      }

      // Queue SMS for each recipient with personalized message
      for (const recipient of groupRecipients) {
        // Get member data for variable replacement
        const memberData = memberDataMap.get(recipient.id);

        // Replace variables in message if member data exists
        const personalizedMessage = memberData
          ? replaceMessageVariables(messageText.trim(), memberData)
          : messageText.trim();

        const { error: queueError } = await supabase
          .from('sms_queue')
          .insert({
            direction: 'outbound',
            phone_number: recipient.phone,
            message: personalizedMessage,
            status: 'pending',
            is_system: false,
            broadcast_id: broadcastId
          });

        if (queueError) throw queueError;
      }

      console.log(`✅ All done! Using broadcast group ${broadcastId}`);

      // Reset sending state before navigation
      setSending(false);
      navigate(`/messages/group/${broadcastId}`, { state: { animationDirection: 'forward' } });
    } catch (error) {
      console.error('Failed to send to group:', error);
      throw error; // Re-throw to be caught by handleSend
    }
  }

  async function resolveGroupMemberIds(group: Group): Promise<string[]> {
    if (group.type === 'static') {
      // Static group - get member IDs from sms_group_members
      const { data: groupMembers, error } = await supabase
        .from('sms_group_members')
        .select('member_id')
        .eq('group_id', group.id);

      if (error) throw error;

      // Get phone numbers to filter out members without phones
      const memberIds = groupMembers?.map(gm => gm.member_id) || [];
      const { data: phoneData } = await supabase
        .from('phone_mappings')
        .select('member_id')
        .in('member_id', memberIds)
        .eq('is_primary', true);

      // Only return members with phone numbers
      const phoneMemberIds = new Set(phoneData?.map(p => p.member_id) || []);
      return memberIds.filter(id => phoneMemberIds.has(id));

    } else {
      // Dynamic group - use RPC function
      const { data: resolvedMembers, error } = await supabase
        .rpc('resolve_dynamic_group_members', { group_id_param: group.id });

      if (error) throw error;

      // Filter members with phone numbers and return IDs
      return (resolvedMembers || [])
        .filter((m: any) => m.phone_number)
        .map((m: any) => m.member_id);
    }
  }

  async function handleSend(messageText: string) {
    // Check we have recipients or groups
    if (recipients.length === 0 && selectedGroupBubbles.length === 0) return;
    if (!messageText.trim()) return;

    setSending(true);

    try {
      // If we have group bubbles, collect all members and combine with individual recipients
      if (selectedGroupBubbles.length > 0) {
        // Collect all member IDs from groups
        const allGroupMemberIds = new Set<string>();
        selectedGroupBubbles.forEach(bubble => {
          bubble.memberIds.forEach(id => allGroupMemberIds.add(id));
        });

        // Get full member data for group members (including visit data for variables)
        const { data: membersData, error: membersError } = await supabase
          .from('members')
          .select('id, first_name, last_name, visits_last_week, visits_last_3_months, last_visit_at')
          .in('id', Array.from(allGroupMemberIds));

        if (membersError) throw membersError;

        // Get phone numbers
        const { data: phoneData, error: phoneError } = await supabase
          .from('phone_mappings')
          .select('member_id, phone_number')
          .in('member_id', Array.from(allGroupMemberIds))
          .eq('is_primary', true);

        if (phoneError) throw phoneError;

        // Create phone map
        const phoneMap = new Map<string, string>();
        phoneData?.forEach(p => {
          phoneMap.set(p.member_id, p.phone_number);
        });

        // Create member data map for variable replacement
        const memberDataMap = new Map<string, MemberWithVisits>();
        membersData?.forEach(m => {
          memberDataMap.set(m.id, {
            id: m.id,
            first_name: m.first_name,
            last_name: m.last_name,
            visits_last_week: m.visits_last_week,
            visits_last_3_months: m.visits_last_3_months,
            last_visit_at: m.last_visit_at
          });
        });

        // Build group recipients list
        const groupRecipients: Recipient[] = (membersData || [])
          .filter(m => phoneMap.has(m.id))
          .map(m => ({
            id: m.id,
            name: `${m.first_name} ${m.last_name}`,
            phone: phoneMap.get(m.id)!,
            type: 'member' as const
          }));

        // Combine with individual recipients, deduplicate by phone number
        const recipientMap = new Map<string, Recipient>();

        // Add group members
        groupRecipients.forEach(r => {
          recipientMap.set(r.phone, r);
        });

        // Add individual recipients (will overwrite if duplicate phone)
        recipients.forEach(r => {
          recipientMap.set(r.phone, r);
        });

        const allRecipients = Array.from(recipientMap.values());

        if (allRecipients.length === 0) {
          alert('Inga mottagare har mobilnummer');
          setSending(false);
          return;
        }

        console.log(`📱 Total ${allRecipients.length} unique recipients`);

        // Create broadcast name
        let broadcastName = '';
        if (selectedGroupBubbles.length === 1 && recipients.length === 0) {
          // Single group only
          broadcastName = selectedGroupBubbles[0].name;
          if (selectedGroupBubbles[0].type === 'dynamic') {
            const now = new Date();
            const timestamp = now.toLocaleString('sv-SE', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            }).replace(',', '');
            broadcastName = `${broadcastName} (${timestamp})`;
          }
        } else if (selectedGroupBubbles.length > 1 && recipients.length === 0) {
          // Multiple groups
          broadcastName = selectedGroupBubbles.map(g => g.name).join(' + ');
        } else if (selectedGroupBubbles.length > 0 && recipients.length > 0) {
          // Groups + individuals
          broadcastName = `${selectedGroupBubbles.map(g => g.name).join(' + ')} + ${recipients.length} mottagare`;
        } else {
          // Just individuals (shouldn't happen in this branch, but provide fallback)
          broadcastName = `${recipients.length} mottagare`;
        }

        // Create broadcast
        const { data: newBroadcast, error: broadcastError } = await supabase
          .from('sms_broadcasts')
          .insert({
            message: messageText.trim(),
            recipient_count: allRecipients.length,
            name: broadcastName
          })
          .select()
          .single();

        if (broadcastError) throw broadcastError;

        const broadcastId = newBroadcast.id;
        console.log('✅ Created broadcast:', broadcastId);

        // Create broadcast recipient records
        for (const recipient of allRecipients) {
          const { error: recipientError } = await supabase
            .from('sms_broadcast_recipients')
            .insert({
              broadcast_id: broadcastId,
              phone_number: recipient.phone,
              member_id: recipient.type === 'member' ? recipient.id : null,
              status: 'pending'
            });

          if (recipientError) throw recipientError;
        }

        // Queue SMS for each recipient with personalized message
        for (const recipient of allRecipients) {
          // Get member data for variable replacement (only for members, not custom recipients)
          const memberData = recipient.type === 'member' ? memberDataMap.get(recipient.id) : null;

          // Replace variables in message if member data exists
          const personalizedMessage = memberData
            ? replaceMessageVariables(messageText.trim(), memberData)
            : messageText.trim();

          const { error: queueError } = await supabase
            .from('sms_queue')
            .insert({
              direction: 'outbound',
              phone_number: recipient.phone,
              message: personalizedMessage,
              status: 'pending',
              is_system: false,
              broadcast_id: broadcastId
            });

          if (queueError) throw queueError;
        }

        console.log(`✅ All done! Using broadcast group ${broadcastId}`);

        // Reset sending state before navigation
        setSending(false);
        navigate(`/messages/group/${broadcastId}`, { state: { animationDirection: 'forward' } });
        return;
      }

      if (recipients.length === 1 && selectedGroupBubbles.length === 0) {
        // Single recipient - create/use conversation thread
        const recipient = recipients[0];

        // Get member data for variable replacement if this is a member
        let memberData: MemberWithVisits | null = null;
        if (recipient.type === 'member') {
          const { data: membersData } = await supabase
            .from('members')
            .select('id, first_name, last_name, visits_last_week, visits_last_3_months, last_visit_at')
            .eq('id', recipient.id)
            .single();

          if (membersData) {
            memberData = {
              id: membersData.id,
              first_name: membersData.first_name,
              last_name: membersData.last_name,
              visits_last_week: membersData.visits_last_week,
              visits_last_3_months: membersData.visits_last_3_months,
              last_visit_at: membersData.last_visit_at
            };
          }
        }

        // Replace variables in message if member data exists
        const personalizedMessage = memberData
          ? replaceMessageVariables(messageText.trim(), memberData)
          : messageText.trim();

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
              last_message_text: personalizedMessage,
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
            message: personalizedMessage,
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

        // Get member data for variable replacement (for members only)
        const memberIds = recipients
          .filter(r => r.type === 'member')
          .map(r => r.id);

        const memberDataMap = new Map<string, MemberWithVisits>();

        if (memberIds.length > 0) {
          const { data: membersData } = await supabase
            .from('members')
            .select('id, first_name, last_name, visits_last_week, visits_last_3_months, last_visit_at')
            .in('id', memberIds);

          membersData?.forEach(m => {
            memberDataMap.set(m.id, {
              id: m.id,
              first_name: m.first_name,
              last_name: m.last_name,
              visits_last_week: m.visits_last_week,
              visits_last_3_months: m.visits_last_3_months,
              last_visit_at: m.last_visit_at
            });
          });
        }

        let broadcastId: string | null = null;

        // For ad-hoc recipients (no group selected), try to reuse existing broadcast
        // NOTE: This is for manually selected recipients, not group-based sends
        const isDynamicGroup = false; // Ad-hoc recipients are always treated as static

        if (!isDynamicGroup) {
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
        } else {
          console.log('⚡ Dynamic group - creating new broadcast for this send');
        }

        // If no existing group found (or dynamic group), create new broadcast
        if (!broadcastId) {
          console.log('➕ Creating new broadcast group...');

          // For ad-hoc recipients, no broadcast name needed
          let broadcastName: string | null = null;
          if (isDynamicGroup && broadcastName) {
            const now = new Date();
            const timestamp = now.toLocaleString('sv-SE', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            }).replace(',', '');
            broadcastName = `${broadcastName} (${timestamp})`;
          }

          const { data: newBroadcast, error: broadcastError } = await supabase
            .from('sms_broadcasts')
            .insert({
              message: messageText.trim(),
              recipient_count: recipients.length,
              name: broadcastName
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

        // Queue SMS for each recipient with personalized message
        console.log('📨 Queuing SMS messages...');
        for (const recipient of recipients) {
          console.log('📤 Queuing for:', recipient.phone);

          // Get member data for variable replacement (only for members, not custom recipients)
          const memberData = recipient.type === 'member' ? memberDataMap.get(recipient.id) : null;

          // Replace variables in message if member data exists
          const personalizedMessage = memberData
            ? replaceMessageVariables(messageText.trim(), memberData)
            : messageText.trim();

          const { error: queueError } = await supabase
            .from('sms_queue')
            .insert({
              direction: 'outbound',
              phone_number: recipient.phone,
              message: personalizedMessage,
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
          {/* Group bubbles */}
          {selectedGroupBubbles.map(groupBubble => (
            <div key={groupBubble.id} className={`inline-flex items-center gap-1.5 rounded-2xl px-3 py-1 text-[15px] max-w-[250px] ${
              groupBubble.type === 'dynamic'
                ? 'bg-purple-100 text-purple-900'
                : 'bg-blue-100 text-blue-900'
            }`}>
              <span className="text-lg">
                {groupBubble.type === 'dynamic' ? '⚡' : '👥'}
              </span>
              <span className="whitespace-nowrap overflow-hidden text-ellipsis font-medium">
                {groupBubble.name}
              </span>
              <span className="text-xs opacity-75">
                ({groupBubble.member_count})
              </span>
              <button
                type="button"
                className="bg-black/20 border-none rounded-full w-[18px] h-[18px] flex items-center justify-center cursor-pointer text-xs text-white flex-shrink-0 p-0 leading-none hover:bg-black/30"
                onClick={() => removeGroupBubble(groupBubble.id)}
                aria-label="Ta bort grupp"
              >
                ✕
              </button>
            </div>
          ))}

          {/* Individual recipient pills */}
          {recipients.map(recipient => (
            <div key={recipient.id} className="inline-flex items-center gap-1.5 bg-gray-200 text-gray-900 rounded-2xl px-3 py-1 text-[15px] max-w-[250px]">
              <span className="text-lg">
                {recipient.type === 'custom' ? '📱' : '👤'}
              </span>
              <span className="whitespace-nowrap overflow-hidden text-ellipsis font-medium">{recipient.name}</span>
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
            onKeyDown={handleKeyDown}
            onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            placeholder={(recipients.length === 0 && selectedGroupBubbles.length === 0) ? "Ange namn, telefonnummer eller grupp" : ""}
            className="border-none outline-none text-[17px] flex-1 min-w-[120px] py-1 bg-transparent placeholder:text-gray-400"
            autoFocus
          />
        </div>

        {/* Search results dropdown */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 bg-white border-b border-gray-300 max-h-[300px] overflow-y-auto z-10">
            {searchResults.map((member, index) => (
              <div
                key={member.id}
                ref={el => { resultRefs.current[index] = el; }}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                  index === selectedIndex
                    ? 'bg-blue-50'
                    : 'hover:bg-gray-50 active:bg-gray-200'
                }`}
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
      {(recipients.length > 0 || selectedGroupBubbles.length > 0) && (
        <div className="px-4 py-2 text-[13px] text-gray-500 bg-white border-b border-gray-300 text-center flex-shrink-0">
          {(() => {
            const totalGroupMembers = selectedGroupBubbles.reduce((sum, g) => sum + g.member_count, 0);
            const totalRecipients = totalGroupMembers + recipients.length;

            if (selectedGroupBubbles.length === 0 && recipients.length === 1) {
              return '1 mottagare';
            }

            const parts: string[] = [];
            if (selectedGroupBubbles.length > 0) {
              parts.push(`${selectedGroupBubbles.length} ${selectedGroupBubbles.length === 1 ? 'grupp' : 'grupper'}`);
            }
            if (recipients.length > 0) {
              parts.push(`${recipients.length} ${recipients.length === 1 ? 'mottagare' : 'mottagare'}`);
            }

            return `${parts.join(' + ')} (totalt ~${totalRecipients} mottagare)`;
          })()}
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 bg-white overflow-y-auto">
        {recipients.length === 0 && selectedGroupBubbles.length === 0 ? (
          <div className="flex items-center justify-center h-full px-5">
            <p className="text-gray-400 text-[17px] text-center">
              Lägg till mottagare för att skicka ett meddelande
            </p>
          </div>
        ) : (
          <div className="p-4">
            <VariableHelper
              onInsertVariable={(variable) => {
                messageInputRef.current?.insertText(variable);
              }}
            />
          </div>
        )}
      </div>

      {/* Message Input - always at bottom */}
      {(recipients.length > 0 || selectedGroupBubbles.length > 0) && (
        <MessageInput
          ref={messageInputRef}
          onSend={handleSend}
          disabled={sending}
        />
      )}
    </MobileContainer>
  );
}
