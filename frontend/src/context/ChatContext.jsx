import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const ChatContext = createContext();

export const useChat = () => useContext(ChatContext);

export const ChatProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);

  const [contacts, setContacts] = useState([]); 
  const [chats, setChats] = useState([]);
  const [onlineStatus, setOnlineStatus] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState({});
  const [typingFrom, setTypingFrom] = useState(new Set());
  const [activeThread, setActiveThread] = useState(null);
  const [threadData, setThreadData] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);

  // AI Suggestions and User Settings Preferences state
  const [userPreferences, setUserPreferences] = useState({
    aiReplySuggestions: true,
    autoReplyEnabled: false,
    autoReplyLanguage: 'auto',
    autoReplyStyle: 'friendly',
    geminiConnected: false
  });
  const [aiSuggestions, setAiSuggestions] = useState({ loading: false, data: null, error: null });

  const selectedUserRef = useRef(selectedUser);
  useEffect(() => { selectedUserRef.current = selectedUser; }, [selectedUser]);

  useEffect(() => {
    if (!currentUser) return;

    const newSocket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000');
    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('chat:register', {
        uid: currentUser.uid,
        name: currentUser.displayName || currentUser.email.split('@')[0],
        photo: currentUser.photoURL || '',
        email: currentUser.email,
      });
    });

    newSocket.on('chat:init', ({ contacts, chats }) => {
      setContacts(contacts);
      setChats(chats);
      
      const newStatus = {};
      contacts.forEach(c => newStatus[c.uid] = c.isOnline);
      chats.forEach(ch => {
        ch.participants.forEach(p => newStatus[p.firebaseUid] = p.isOnline);
      });
      setOnlineStatus(prev => ({ ...prev, ...newStatus }));
    });

    newSocket.on('chat:user:status', ({ uid, isOnline }) => {
      setOnlineStatus(prev => ({ ...prev, [uid]: isOnline }));
    });

    newSocket.on('chat:receive', (msg) => {
      const peerUid = msg.from === currentUser.uid ? msg.to : msg.from;
      setMessages(prev => {
        const existing = prev[peerUid] || [];
        if (existing.find(m => m.id === msg.id)) return prev;
        return { ...prev, [peerUid]: [...existing, msg] };
      });
      // Note: chat:init is also emitted by server on message send/receive, 
      // so unread counts and recent chats order will update automatically.
    });

    newSocket.on('chat:typing', ({ from, isTyping }) => {
      setTypingFrom(prev => {
        const next = new Set(prev);
        isTyping ? next.add(from) : next.delete(from);
        return next;
      });
    });

    newSocket.on('chat:history', ({ with: withUid, messages: history }) => {
      setMessages(prev => ({ ...prev, [withUid]: history }));
    });

    newSocket.on('chat:thread:data', ({ threadId, messages }) => {
      setThreadData(prev => ({ ...prev, [threadId]: messages }));
    });

    newSocket.on('chat:message:update', ({ threadId, replyCount }) => {
      setMessages(prev => {
        const next = { ...prev };
        for (const peerUid in next) {
          next[peerUid] = next[peerUid].map(m => {
            if (m.id === threadId) {
              return { ...m, replyCount };
            }
            return m;
          });
        }
        return next;
      });
    });

    newSocket.on('chat:suggestions', ({ withUid, suggestions, error }) => {
      if (selectedUserRef.current?.uid === withUid) {
        if (error) {
          setAiSuggestions({ loading: false, data: null, error });
        } else {
          setAiSuggestions({ loading: false, data: suggestions, error: null });
        }
      }
    });

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [currentUser]);

  // Load and update user preferences
  useEffect(() => {
    if (!currentUser) return;

    // Quick load from local storage
    const cachedPrefs = localStorage.getItem(`prefs_${currentUser.uid}`);
    if (cachedPrefs) {
      try {
        setUserPreferences(JSON.parse(cachedPrefs));
      } catch (err) {
        console.error(err);
      }
    }

    const fetchPreferences = async () => {
      try {
        const baseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
        const res = await fetch(`${baseUrl}/api/users/settings/${currentUser.uid}`);
        if (res.ok) {
          const data = await res.json();
          setUserPreferences(data);
          localStorage.setItem(`prefs_${currentUser.uid}`, JSON.stringify(data));
        }
      } catch (err) {
        console.error('Error fetching user preferences:', err);
      }
    };

    fetchPreferences();
  }, [currentUser]);

  const updateUserSettings = useCallback(async (newPrefs) => {
    if (!currentUser) return;

    // Optimistic local update
    setUserPreferences(prev => {
      const updated = { ...prev, ...newPrefs };
      localStorage.setItem(`prefs_${currentUser.uid}`, JSON.stringify(updated));
      return updated;
    });

    try {
      const baseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      const res = await fetch(`${baseUrl}/api/users/settings/${currentUser.uid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newPrefs)
      });
      if (!res.ok) {
        throw new Error('Failed to update settings on server');
      }
    } catch (err) {
      console.error('Error updating settings:', err);
    }
  }, [currentUser]);

  // Debounced effect for suggestions
  useEffect(() => {
    console.log('🔮 AI suggestions effect triggered. active chat:', selectedUser?.uid, 'suggestions enabled:', userPreferences.aiReplySuggestions);
    if (!socket || !selectedUser || !userPreferences.aiReplySuggestions) {
      setAiSuggestions({ loading: false, data: null, error: null });
      return;
    }

    const chatMessages = messages[selectedUser.uid] || [];
    console.log('🔮 Chat messages count:', chatMessages.length);
    if (chatMessages.length === 0) {
      setAiSuggestions({ loading: false, data: null, error: null });
      return;
    }

    const lastMessage = chatMessages[chatMessages.length - 1];
    console.log('🔮 Last message from:', lastMessage.from, 'current user:', currentUser?.uid, 'message text:', lastMessage.message);

    // If last message is from current user, we don't need suggestions
    if (lastMessage.from === currentUser?.uid) {
      console.log('🔮 Last message is from myself. Clearing suggestions.');
      setAiSuggestions({ loading: false, data: null, error: null });
      return;
    }

    // Set loading state
    setAiSuggestions(prev => ({ ...prev, loading: true }));

    const timer = setTimeout(() => {
      console.log('🔮 Emitting chat:suggestions:get for peer:', selectedUser.uid);
      socket.emit('chat:suggestions:get', { withUid: selectedUser.uid });
    }, 600); // 600ms debounce

    return () => clearTimeout(timer);
  }, [selectedUser, messages, userPreferences.aiReplySuggestions, socket, currentUser]);

  const selectUser = useCallback((user) => {
    setSelectedUser(user);
    if (socketRef.current) {
      socketRef.current.emit('chat:history:get', { with: user.uid });
    }
  }, []);

  const addContact = useCallback((user) => {
    // We can optimistically add to contacts state, but ideally we wait for server to send chat:init.
    // Let's just do it optimistically.
    setContacts(prev => {
      if (prev.some(c => c.uid === user.uid)) return prev;
      return [...prev, user];
    });
    selectUser(user);
  }, [selectUser]);

  const sendMessage = useCallback((text, replyToId = null) => {
    if (!socketRef.current || !selectedUserRef.current || !text.trim()) return;
    socketRef.current.emit('chat:send', {
      to: selectedUserRef.current.uid,
      message: text.trim(),
      timestamp: Date.now(),
      replyTo: replyToId,
    });
    setReplyingTo(null); // Reset reply state after sending
  }, []);

  const getThread = useCallback((threadId) => {
    if (!socketRef.current || !selectedUserRef.current) return;
    socketRef.current.emit('chat:thread:get', { threadId, withUid: selectedUserRef.current.uid });
  }, []);

  const setTyping = useCallback((isTyping) => {
    if (!socketRef.current || !selectedUserRef.current) return;
    socketRef.current.emit('chat:typing', {
      to: selectedUserRef.current.uid,
      isTyping,
    });
  }, []);

  const updateContactSettings = useCallback(({ targetUid, customName, nickname, customLabel }) => {
    if (!socketRef.current) return;
    socketRef.current.emit('chat:settings:update', { targetUid, customName, nickname, customLabel });
  }, []);

  const clearChat = useCallback(({ targetUid }) => {
    if (!socketRef.current) return;
    socketRef.current.emit('chat:clear', { targetUid });
  }, []);

  const blockUser = useCallback(({ targetUid }) => {
    if (!socketRef.current) return;
    socketRef.current.emit('chat:block', { targetUid });
    if (selectedUserRef.current?.uid === targetUid) {
      setSelectedUser(null);
    }
  }, []);

  // Compute total unread for header badge
  const unreadTotal = chats.reduce((total, chat) => total + (chat.unreadCounts[currentUser?.uid] || 0), 0);

  return (
    <ChatContext.Provider value={{
      contacts,
      chats,
      onlineStatus,
      selectedUser,
      selectUser,
      addContact,
      messages,
      typingFrom,
      unreadTotal,
      sendMessage,
      setTyping,
      updateContactSettings,
      clearChat,
      blockUser,
      currentUser,
      replyingTo,
      setReplyingTo,
      activeThread,
      setActiveThread,
      threadData,
      getThread,
      socket,
      userPreferences,
      updateUserSettings,
      aiSuggestions
    }}>
      {children}
    </ChatContext.Provider>
  );
};
