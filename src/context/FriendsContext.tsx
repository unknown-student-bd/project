import React, { createContext, useContext, useState, useEffect } from 'react';
import { Friend, FriendRequest, StudySession, GroupMessage } from '../types';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

interface FriendsContextType {
  friends: Friend[];
  friendRequests: FriendRequest[];
  studySessions: StudySession[];
  groupMessages: GroupMessage[];
  sendFriendRequest: (email: string) => Promise<boolean>;
  acceptFriendRequest: (requestId: string) => Promise<boolean>;
  rejectFriendRequest: (requestId: string) => Promise<boolean>;
  removeFriend: (friendId: string) => Promise<boolean>;
  updateStudyStatus: (status: 'studying' | 'break' | 'offline', subject?: string) => Promise<void>;
  sendGroupMessage: (message: string, mentions?: string[]) => Promise<void>;
  isLoading: boolean;
}

const FriendsContext = createContext<FriendsContextType | undefined>(undefined);

export const useFriends = () => {
  const context = useContext(FriendsContext);
  if (!context) {
    throw new Error('useFriends must be used within a FriendsProvider');
  }
  return context;
};

export const FriendsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadFriendsData();
      setupRealtimeSubscriptions();
    } else {
      setFriends([]);
      setFriendRequests([]);
      setStudySessions([]);
      setGroupMessages([]);
    }
  }, [user]);

  const loadFriendsData = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      await Promise.all([
        loadFriends(),
        loadFriendRequests(),
        loadStudySessions(),
        loadGroupMessages()
      ]);
    } catch (error) {
      console.error('Error loading friends data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFriends = async () => {
    if (!user) return;

    const { data: friendsData, error } = await supabase
      .from('friends')
      .select('id, user_id, friend_id, created_at')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error loading friends:', error);
      return;
    }

    if (!friendsData || friendsData.length === 0) {
      setFriends([]);
      return;
    }

    // Get friend user details separately
    const friendIds = friendsData.map(f => f.friend_id);
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, name, email')
      .in('id', friendIds);

    if (usersError) {
      console.error('Error loading friend user details:', usersError);
      return;
    }

    // Map friend details to friends data
    const friendsWithDetails = friendsData.map(f => {
      const friendUser = usersData?.find(u => u.id === f.friend_id);
      return {
        id: f.id,
        user_id: f.user_id,
        friend_id: f.friend_id,
        friend_name: friendUser?.name || 'Unknown',
        friend_email: friendUser?.email || '',
        created_at: f.created_at
      };
    });

    setFriends(friendsWithDetails);
  };

  const loadFriendRequests = async () => {
    if (!user) return;

    const { data: requestsData, error } = await supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id, status, created_at')
      .eq('receiver_id', user.id)
      .eq('status', 'pending');

    if (error) {
      console.error('Error loading friend requests:', error);
      return;
    }

    if (!requestsData || requestsData.length === 0) {
      setFriendRequests([]);
      return;
    }

    // Get sender user details separately
    const senderIds = requestsData.map(r => r.sender_id);
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, name, email')
      .in('id', senderIds);

    if (usersError) {
      console.error('Error loading sender user details:', usersError);
      return;
    }

    // Map sender details to requests data
    const requestsWithDetails = requestsData.map(r => {
      const senderUser = usersData?.find(u => u.id === r.sender_id);
      return {
        ...r,
        sender_name: senderUser?.name || 'Unknown',
        sender_email: senderUser?.email || '',
        status: r.status as 'pending' | 'accepted' | 'rejected'
      };
    });

    setFriendRequests(requestsWithDetails);
  };

  const loadStudySessions = async () => {
    if (!user) return;

    const friendIds = friends.map(f => f.friend_id);
    const allUserIds = [user.id, ...friendIds];

    const { data: sessionsData, error } = await supabase
      .from('study_sessions')
      .select('id, user_id, status, subject, started_at, last_active')
      .in('user_id', allUserIds);

    if (error) {
      console.error('Error loading study sessions:', error);
      return;
    }

    if (!sessionsData || sessionsData.length === 0) {
      setStudySessions([]);
      return;
    }

    // Get user details separately
    const userIds = sessionsData.map(s => s.user_id);
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, name')
      .in('id', userIds);

    if (usersError) {
      console.error('Error loading session user details:', usersError);
      return;
    }

    // Map user details to sessions data
    const sessionsWithDetails = sessionsData.map(s => {
      const sessionUser = usersData?.find(u => u.id === s.user_id);
      return {
        id: s.id,
        user_id: s.user_id,
        user_name: sessionUser?.name || 'Unknown',
        status: s.status as 'studying' | 'break' | 'offline',
        subject: s.subject,
        started_at: s.started_at,
        last_active: s.last_active
      };
    });

    setStudySessions(sessionsWithDetails);
  };

  const loadGroupMessages = async () => {
    if (!user) return;

    const { data: messagesData, error } = await supabase
      .from('group_messages')
      .select('id, user_id, message, mentions, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error loading group messages:', error);
      return;
    }

    if (!messagesData || messagesData.length === 0) {
      setGroupMessages([]);
      return;
    }

    // Get user details separately
    const userIds = [...new Set(messagesData.map(m => m.user_id))];
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, name')
      .in('id', userIds);

    if (usersError) {
      console.error('Error loading message user details:', usersError);
      return;
    }

    // Map user details to messages data
    const messagesWithDetails = messagesData.map(m => {
      const messageUser = usersData?.find(u => u.id === m.user_id);
      return {
        id: m.id,
        user_id: m.user_id,
        user_name: messageUser?.name || 'Unknown',
        message: m.message,
        mentions: m.mentions || [],
        created_at: m.created_at
      };
    });

    setGroupMessages(messagesWithDetails.reverse());
  };

  const setupRealtimeSubscriptions = () => {
    if (!user) return;

    // Subscribe to friend requests
    const friendRequestsSubscription = supabase
      .channel('friend_requests')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'friend_requests' },
        () => loadFriendRequests()
      )
      .subscribe();

    // Subscribe to study sessions
    const studySessionsSubscription = supabase
      .channel('study_sessions')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'study_sessions' },
        () => loadStudySessions()
      )
      .subscribe();

    // Subscribe to group messages
    const groupMessagesSubscription = supabase
      .channel('group_messages')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages' },
        () => loadGroupMessages()
      )
      .subscribe();

    return () => {
      friendRequestsSubscription.unsubscribe();
      studySessionsSubscription.unsubscribe();
      groupMessagesSubscription.unsubscribe();
    };
  };

  const sendFriendRequest = async (email: string): Promise<boolean> => {
    if (!user) return false;

    try {
      // Find user by email
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (userError || !userData) {
        throw new Error('User not found');
      }

      if (userData.id === user.id) {
        throw new Error('Cannot send friend request to yourself');
      }

      // Check if already friends
      const { data: existingFriend } = await supabase
        .from('friends')
        .select('id')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${userData.id}),and(user_id.eq.${userData.id},friend_id.eq.${user.id})`)
        .single();

      if (existingFriend) {
        throw new Error('Already friends with this user');
      }

      // Send friend request
      const { error } = await supabase
        .from('friend_requests')
        .insert({
          sender_id: user.id,
          receiver_id: userData.id
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error sending friend request:', error);
      return false;
    }
  };

  const acceptFriendRequest = async (requestId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      // Get the request details
      const { data: request, error: requestError } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id')
        .eq('id', requestId)
        .single();

      if (requestError || !request) throw requestError;

      // Create friendship (both directions)
      const { error: friendError } = await supabase
        .from('friends')
        .insert([
          { user_id: request.receiver_id, friend_id: request.sender_id },
          { user_id: request.sender_id, friend_id: request.receiver_id }
        ]);

      if (friendError) throw friendError;

      // Update request status
      const { error: updateError } = await supabase
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      if (updateError) throw updateError;

      await loadFriends();
      await loadFriendRequests();
      return true;
    } catch (error) {
      console.error('Error accepting friend request:', error);
      return false;
    }
  };

  const rejectFriendRequest = async (requestId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      if (error) throw error;

      await loadFriendRequests();
      return true;
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      return false;
    }
  };

  const removeFriend = async (friendId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('friends')
        .delete()
        .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`);

      if (error) throw error;

      await loadFriends();
      return true;
    } catch (error) {
      console.error('Error removing friend:', error);
      return false;
    }
  };

  const updateStudyStatus = async (status: 'studying' | 'break' | 'offline', subject?: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('study_sessions')
        .upsert({
          user_id: user.id,
          status,
          subject: subject || null,
          last_active: new Date().toISOString()
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error updating study status:', error);
    }
  };

  const sendGroupMessage = async (message: string, mentions: string[] = []) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('group_messages')
        .insert({
          user_id: user.id,
          message,
          mentions
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending group message:', error);
    }
  };

  return (
    <FriendsContext.Provider value={{
      friends,
      friendRequests,
      studySessions,
      groupMessages,
      sendFriendRequest,
      acceptFriendRequest,
      rejectFriendRequest,
      removeFriend,
      updateStudyStatus,
      sendGroupMessage,
      isLoading
    }}>
      {children}
    </FriendsContext.Provider>
  );
};