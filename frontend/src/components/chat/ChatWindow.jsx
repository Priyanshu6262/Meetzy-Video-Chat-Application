import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Smile, ArrowLeft, MoreVertical } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import EmojiPicker from './EmojiPicker';
import ProfileSettingsModal from './ProfileSettingsModal';
import ConfirmModal from './ConfirmModal';
import ThreadPopup from './ThreadPopup';
import { Ban, Trash2, UserCircle, X } from 'lucide-react';

const Avatar = ({ src, name, size = 'md' }) => {
  const dim = size === 'md' ? 'w-10 h-10' : 'w-8 h-8';
  const initial = (name || 'U')[0].toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${dim} rounded-full object-cover flex-shrink-0`}
        onError={e => { e.target.style.display = 'none'; }}
      />
    );
  }
  return (
    <div className={`${dim} rounded-full bg-gradient-to-br from-indigo-500 to-blue-600
                     flex items-center justify-center flex-shrink-0`}>
      <span className="text-sm font-bold text-white">{initial}</span>
    </div>
  );
};

const TypingIndicator = () => (
  <div className="flex items-end gap-2 mb-2">
    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
    <div className="flex items-center gap-1 bg-white dark:bg-slate-800
                    border border-slate-200 dark:border-slate-700
                    rounded-2xl rounded-bl-none px-4 py-3">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 bg-slate-400 rounded-full"
          animate={{ y: ['0%', '-50%', '0%'] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </div>
  </div>
);

const formatMsgTime = (ts) => {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

import { Reply } from 'lucide-react';

const MessageBubble = ({ msg, isMe, showAvatar, senderPhoto, senderName, onReply, onOpenThread }) => (
  <motion.div
    initial={{ opacity: 0, y: 8, scale: 0.97 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.18 }}
    className={`flex items-end gap-2 mb-1 group ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
  >
    {/* Avatar placeholder for alignment */}
    <div className="w-7 h-7 flex-shrink-0">
      {showAvatar && !isMe && (
        <img
          src={senderPhoto || ''}
          alt={senderName}
          className="w-7 h-7 rounded-full object-cover"
          onError={e => { e.target.style.display = 'none'; }}
        />
      )}
    </div>

    <div className={`flex flex-col gap-0.5 max-w-[70%] relative ${isMe ? 'items-end' : 'items-start'}`}>
      
      {/* Reply Button (Hover) */}
      <button 
        onClick={() => onReply(msg)}
        className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-500 z-10 ${isMe ? '-left-10' : '-right-10'}`}
        title="Reply"
      >
        <Reply className="w-4 h-4" />
      </button>

      <div
        onDoubleClick={() => onReply(msg)}
        className={`
          px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words relative select-none cursor-pointer
          ${isMe
            ? 'bg-indigo-600 text-white rounded-br-none shadow-lg shadow-indigo-500/20'
            : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-bl-none shadow-sm'}
        `}
      >
        {/* Reply Preview inside bubble */}
        {msg.replyTo && (
          <div className={`mb-2 p-2 rounded-lg text-xs border-l-4 ${isMe ? 'bg-indigo-700/50 border-indigo-300' : 'bg-slate-100 dark:bg-slate-700/50 border-indigo-500'}`}>
            <p className={`font-semibold mb-0.5 ${isMe ? 'text-indigo-100' : 'text-indigo-600 dark:text-indigo-400'}`}>
              {msg.replyTo.senderName}
            </p>
            <p className={`truncate ${isMe ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-400'}`}>
              {msg.replyTo.text}
            </p>
          </div>
        )}

        {msg.message}
      </div>

      <div className={`flex items-center gap-2 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">
          {formatMsgTime(msg.timestamp)}
        </span>
        
        {/* Thread replies counter */}
        {msg.replyCount >= 4 && (
          <button 
            onClick={() => onOpenThread(msg)}
            className="text-[10px] font-medium text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            {msg.replyCount} Replies
          </button>
        )}
      </div>
    </div>
  </motion.div>
);

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400 select-none">
    <div className="w-24 h-24 rounded-full bg-indigo-50 dark:bg-indigo-900/20
                    flex items-center justify-center">
      <svg viewBox="0 0 48 48" className="w-12 h-12 text-indigo-400" fill="none">
        <path d="M24 4C12.95 4 4 12.95 4 24c0 3.37.84 6.54 2.3 9.33L4 44l10.96-2.27A19.9 19.9 0 0024 44c11.05 0 20-8.95 20-20S35.05 4 24 4z"
          fill="currentColor" opacity=".15" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
        <circle cx="16" cy="24" r="2" fill="currentColor"/>
        <circle cx="24" cy="24" r="2" fill="currentColor"/>
        <circle cx="32" cy="24" r="2" fill="currentColor"/>
      </svg>
    </div>
    <div className="text-center">
      <p className="font-semibold text-slate-600 dark:text-slate-300 text-lg">Select a conversation</p>
      <p className="text-sm mt-1">Choose a user from the sidebar to start chatting</p>
    </div>
  </div>
);

const ChatWindow = ({ onBackClick }) => {
  const { selectedUser, messages, typingFrom, sendMessage, setTyping, currentUser, clearChat, blockUser, replyingTo, setReplyingTo, activeThread, setActiveThread } = useChat();
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isBlockConfirmOpen, setIsBlockConfirmOpen] = useState(false);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const typingTimeout = useRef(null);

  const conv = selectedUser ? (messages[selectedUser.uid] || []) : [];
  const isTyping = selectedUser && typingFrom.has(selectedUser.uid);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conv, isTyping]);

  // Close menu if clicked outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when user selected
  useEffect(() => {
    if (selectedUser) inputRef.current?.focus();
  }, [selectedUser]);

  const handleSend = (e) => {
    if (e) e.preventDefault();
    if (input.trim()) {
      sendMessage(input.trim(), replyingTo ? replyingTo.id : null);
      setInput('');
      setShowEmoji(false);
      setReplyingTo(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    setTyping(true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => setTyping(false), 2000);
  };

  const handleEmojiSelect = (emoji) => {
    setInput(prev => prev + emoji);
    inputRef.current?.focus();
  };

  if (!selectedUser) {
    return (
      <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950">
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 h-full relative">
      <ProfileSettingsModal 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
        user={selectedUser} 
      />
      <ConfirmModal
        isOpen={isClearConfirmOpen}
        onClose={() => setIsClearConfirmOpen(false)}
        onConfirm={() => clearChat({ targetUid: selectedUser.uid })}
        title="Clear Chat History"
        message={`Are you sure you want to clear your chat history with ${selectedUser.name}? This cannot be undone.`}
        confirmText="Clear Chat"
        isDestructive={true}
      />
      <ConfirmModal
        isOpen={isBlockConfirmOpen}
        onClose={() => setIsBlockConfirmOpen(false)}
        onConfirm={() => blockUser({ targetUid: selectedUser.uid })}
        title="Block User"
        message={`Are you sure you want to block ${selectedUser.name}? You will no longer receive messages from them.`}
        confirmText="Block User"
        isDestructive={true}
      />
      <ThreadPopup 
        isOpen={!!activeThread}
        onClose={() => setActiveThread(null)}
        threadId={activeThread}
      />
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3
                      bg-white dark:bg-slate-900
                      border-b border-slate-200 dark:border-slate-800
                      shadow-sm flex-shrink-0">
        {/* Mobile back button */}
        <button
          onClick={onBackClick}
          className="md:hidden p-1.5 -ml-1 rounded-full
                     hover:bg-slate-100 dark:hover:bg-slate-800
                     text-slate-600 dark:text-slate-300 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="relative flex-shrink-0">
          <Avatar src={selectedUser.photo} name={selectedUser.name} />
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full
                           bg-emerald-500 border-2 border-white dark:border-slate-900" />
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-slate-900 dark:text-white truncate text-sm flex items-center gap-2">
            {selectedUser.name}
            {selectedUser.customLabel && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                {selectedUser.customLabel}
              </span>
            )}
          </h2>
          <AnimatePresence mode="wait">
            {isTyping ? (
              <motion.p
                key="typing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs text-indigo-500 font-medium"
              >
                typing…
              </motion.p>
            ) : (
              <motion.p
                key="online"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs text-emerald-500 font-medium flex items-center gap-1.5"
              >
                Online {selectedUser.nickname && <span className="text-slate-400">• {selectedUser.nickname}</span>}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800
                       text-slate-500 dark:text-slate-400 transition-colors"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          
          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, transformOrigin: 'top right' }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.1 }}
                className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-10"
              >
                <button
                  onClick={() => { setIsProfileOpen(true); setIsMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <UserCircle className="w-4 h-4 text-indigo-500" />
                  View/Edit Profile
                </button>
                <button
                  onClick={() => { setIsClearConfirmOpen(true); setIsMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-amber-500" />
                  Clear Chat
                </button>
                <button
                  onClick={() => { setIsBlockConfirmOpen(true); setIsMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                >
                  <Ban className="w-4 h-4" />
                  Block User
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5
                      scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
        {conv.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
            <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-900/20
                            flex items-center justify-center">
              <Avatar src={selectedUser.photo} name={selectedUser.name} />
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Say hi to {selectedUser.name}! 👋
            </p>
            <p className="text-xs text-slate-400">This is the beginning of your conversation.</p>
          </div>
        ) : (
          <>
            {conv.map((msg, i) => {
              const isMe = msg.from === currentUser?.uid;
              const nextMsg = conv[i + 1];
              const showAvatar = !isMe && (!nextMsg || nextMsg.from !== msg.from);
              return (
                <MessageBubble
                  key={msg.id || i}
                  msg={msg}
                  isMe={isMe}
                  showAvatar={showAvatar}
                  senderPhoto={selectedUser.photo}
                  senderName={selectedUser.name}
                  onReply={(msg) => setReplyingTo(msg)}
                  onOpenThread={(msg) => setActiveThread(msg.threadId || msg.id)}
                />
              );
            })}
          </>
        )}

        {isTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input Bar */}
      <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        
        {/* Reply Preview Box */}
        <AnimatePresence>
          {replyingTo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 relative flex items-center justify-between"
            >
              <div className="flex-1 p-3 border-l-4 border-indigo-500 min-w-0">
                <p className="font-semibold text-xs text-indigo-600 dark:text-indigo-400 mb-0.5 truncate">
                  Replying to {replyingTo.from === currentUser?.uid ? 'yourself' : selectedUser.name}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                  {replyingTo.message}
                </p>
              </div>
              <button 
                onClick={() => setReplyingTo(null)}
                className="p-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="px-4 py-3 flex items-end gap-2 relative">
          {/* Emoji Picker */}
          <EmojiPicker
            isOpen={showEmoji}
            onSelect={handleEmojiSelect}
            onClose={() => setShowEmoji(false)}
          />

          <button
            onClick={() => setShowEmoji(v => !v)}
            className={`p-2.5 rounded-xl transition-colors flex-shrink-0
              ${showEmoji
                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <Smile className="w-5 h-5" />
          </button>

          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              rows={1}
              className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800
                         text-slate-900 dark:text-white placeholder-slate-400
                         rounded-2xl text-sm resize-none focus:outline-none
                         focus:ring-2 focus:ring-indigo-500 transition-all
                         max-h-28 overflow-y-auto leading-relaxed"
              style={{ minHeight: '42px' }}
            />
          </div>

          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleSend}
            disabled={!input.trim()}
            className={`p-2.5 rounded-xl flex-shrink-0 transition-all
              ${input.trim()
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/25'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'}`}
          >
            <Send className="w-5 h-5" />
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
