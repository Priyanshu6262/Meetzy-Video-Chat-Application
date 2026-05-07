import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const ChatContext = createContext();

export const useChat = () => useContext(ChatContext);

export const ChatProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const socketRef = useRef(null);

  const [contacts, setContacts] = useState([]); 
  const [chats, setChats] = useState([]);
  const [onlineStatus, setOnlineStatus] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState({});
  const [typingFrom, setTypingFrom] = useState(new Set());

  const selectedUserRef = useRef(selectedUser);
  useEffect(() => { selectedUserRef.current = selectedUser; }, [selectedUser]);

  useEffect(() => {
    if (!currentUser) return;

    const socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000');
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('chat:register', {
        uid: currentUser.uid,
        name: currentUser.displayName || currentUser.email.split('@')[0],
        photo: currentUser.photoURL || '',
        email: currentUser.email,
      });
    });

    socket.on('chat:init', ({ contacts, chats }) => {
      setContacts(contacts);
      setChats(chats);
      
      const newStatus = {};
      contacts.forEach(c => newStatus[c.uid] = c.isOnline);
      chats.forEach(ch => {
        ch.participants.forEach(p => newStatus[p.firebaseUid] = p.isOnline);
      });
      setOnlineStatus(prev => ({ ...prev, ...newStatus }));
    });

    socket.on('chat:user:status', ({ uid, isOnline }) => {
      setOnlineStatus(prev => ({ ...prev, [uid]: isOnline }));
    });

    socket.on('chat:receive', (msg) => {
      const peerUid = msg.from === currentUser.uid ? msg.to : msg.from;
      setMessages(prev => {
        const existing = prev[peerUid] || [];
        if (existing.find(m => m.id === msg.id)) return prev;
        return { ...prev, [peerUid]: [...existing, msg] };
      });
      // Note: chat:init is also emitted by server on message send/receive, 
      // so unread counts and recent chats order will update automatically.
    });

    socket.on('chat:typing', ({ from, isTyping }) => {
      setTypingFrom(prev => {
        const next = new Set(prev);
        isTyping ? next.add(from) : next.delete(from);
        return next;
      });
    });

    socket.on('chat:history', ({ with: withUid, messages: history }) => {
      setMessages(prev => ({ ...prev, [withUid]: history }));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [currentUser]);

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

  const sendMessage = useCallback((text) => {
    if (!socketRef.current || !selectedUserRef.current || !text.trim()) return;
    socketRef.current.emit('chat:send', {
      to: selectedUserRef.current.uid,
      message: text.trim(),
      timestamp: Date.now(),
    });
  }, []);

  const setTyping = useCallback((isTyping) => {
    if (!socketRef.current || !selectedUserRef.current) return;
    socketRef.current.emit('chat:typing', {
      to: selectedUserRef.current.uid,
      isTyping,
    });
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
      unreadTotal, // For navigation badge if any
      sendMessage,
      setTyping,
      currentUser,
    }}>
      {children}
    </ChatContext.Provider>
  );
};
