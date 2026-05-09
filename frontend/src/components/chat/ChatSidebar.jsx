import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MessageSquare } from 'lucide-react';
import { useChat } from '../../context/ChatContext';

const Avatar = ({ src, name, size = 'md' }) => {
  const dim = size === 'md' ? 'w-12 h-12' : 'w-10 h-10';
  const text = size === 'md' ? 'text-lg' : 'text-sm';
  const initial = (name || 'U')[0].toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${dim} rounded-full object-cover flex-shrink-0`}
        onError={e => { e.target.onerror = null; e.target.style.display = 'none'; }}
      />
    );
  }
  return (
    <div className={`${dim} rounded-full bg-gradient-to-br from-indigo-500 to-blue-600
                     flex items-center justify-center flex-shrink-0`}>
      <span className={`${text} font-bold text-white`}>{initial}</span>
    </div>
  );
};

const ChatSidebar = ({ isMobileOpen, onClose }) => {
  const { contacts, chats, onlineStatus, selectedUser, selectUser, currentUser } = useChat();
  const [search, setSearch] = useState('');

  // Merge contacts and chats uniquely by uid
  const allUsers = useMemo(() => {
    const map = new Map();
    
    // 1. Add all contacts first
    contacts.forEach(c => {
      map.set(c.uid, {
        uid: c.uid,
        name: c.name,
        email: c.email,
        photo: c.photo,
        isOnline: onlineStatus[c.uid] || false,
        lastMessage: null,
        lastMessageTime: 0,
        unreadCount: 0
      });
    });

    // 2. Add/Update from chats (which includes lastMessage and unreadCounts)
    chats.forEach(chat => {
      // Find the other participant
      const otherParticipant = chat.participants.find(p => p.firebaseUid !== currentUser?.uid);
      if (!otherParticipant) return;

      const uid = otherParticipant.firebaseUid;
      const existing = map.get(uid) || {
        uid,
        name: otherParticipant.name,
        email: otherParticipant.email,
        photo: otherParticipant.photo,
        isOnline: onlineStatus[uid] || false,
      };

      if (chat.lastMessage) {
        // chat.lastMessage.senderId might be a populated object or an ObjectId string depending on the populate.
        // Wait, in server.js, lastMessage is populated but senderId isn't specifically populated, so it's an ObjectId.
        // But otherParticipant._id is also an ObjectId.
        const isMe = chat.lastMessage.senderId?.toString() !== otherParticipant._id?.toString();
        existing.lastMessage = {
          text: isMe ? `You: ${chat.lastMessage.text}` : `${otherParticipant.name}: ${chat.lastMessage.text}`,
          time: new Date(chat.lastMessage.createdAt).getTime()
        };
        existing.lastMessageTime = existing.lastMessage.time;
      }
      
      existing.unreadCount = chat.unreadCounts[currentUser?.uid] || 0;
      map.set(uid, existing);
    });

    // Convert to array and sort by latest message time, then name
    return Array.from(map.values()).sort((a, b) => {
      if (a.lastMessageTime !== b.lastMessageTime) {
        return (b.lastMessageTime || 0) - (a.lastMessageTime || 0);
      }
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [contacts, chats, onlineStatus, currentUser]);

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    return allUsers.filter(u =>
      u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    );
  }, [allUsers, search]);

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const handleSelect = (user) => {
    selectUser(user);
    onClose?.();
  };

  return (
    <div className={`
      flex flex-col h-full
      bg-white dark:bg-slate-900
      border-r border-slate-200 dark:border-slate-800
    `}>
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Chats</h1>
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400
                             bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
              {allUsers.length} contact{allUsers.length !== 1 && 's'}
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search users..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800
                       text-slate-900 dark:text-white placeholder-slate-400
                       rounded-xl text-sm focus:outline-none focus:ring-2
                       focus:ring-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* User List */}
      <div className="flex-1 overflow-y-auto">
        {filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400 dark:text-slate-600 px-6 text-center">
            <MessageSquare className="w-12 h-12 opacity-30" />
            <p className="text-sm">
              {allUsers.length === 0
                ? 'No chats yet.\nClick + to add a user by email!'
                : 'No users match your search.'}
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredUsers.map((user, i) => {
              const lastMsg = user.lastMessage;
              const unreadCount = user.unreadCount;
              const isActive = selectedUser?.uid === user.uid;

              return (
                <motion.button
                  key={user.uid}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2, delay: i * 0.03 }}
                  onClick={() => handleSelect(user)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 text-left
                    transition-colors relative
                    ${isActive
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 border-r-2 border-indigo-600'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}
                  `}
                >
                  {/* Avatar + Online Dot */}
                  <div className="relative flex-shrink-0">
                    <Avatar src={user.photo} name={user.name} />
                    {user.isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full
                                       bg-emerald-500 border-2 border-white dark:border-slate-900" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`font-semibold text-sm truncate
                        ${isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-900 dark:text-white'}`}>
                        {user.name}
                      </span>
                      {lastMsg && (
                        <span className="text-xs text-slate-400 flex-shrink-0">
                          {formatTime(lastMsg.time)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {lastMsg ? lastMsg.text : (
                          user.isOnline 
                            ? <span className="text-indigo-500 dark:text-indigo-400">Online • Tap to chat</span>
                            : <span>Offline</span>
                        )}
                      </p>
                      {unreadCount > 0 && (
                        <span className="flex-shrink-0 min-w-[18px] h-[18px] bg-indigo-600
                                         text-white text-xs font-bold rounded-full
                                         flex items-center justify-center px-1">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Current user footer */}
      {currentUser && (
        <div className="p-3 border-t border-slate-100 dark:border-slate-800
                        bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <Avatar src={currentUser.photoURL} name={currentUser.displayName || currentUser.email} size="sm" />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full
                               bg-emerald-500 border-2 border-white dark:border-slate-900" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                {currentUser.displayName || currentUser.email.split('@')[0]}
              </p>
              <p className="text-xs text-emerald-500">You • Online</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatSidebar;
