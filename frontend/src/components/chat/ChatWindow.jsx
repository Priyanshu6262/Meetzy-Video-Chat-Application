import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Smile, ArrowLeft, MoreVertical } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import EmojiPicker from './EmojiPicker';

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

const MessageBubble = ({ msg, isMe, showAvatar, senderPhoto, senderName }) => (
  <motion.div
    initial={{ opacity: 0, y: 8, scale: 0.97 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.18 }}
    className={`flex items-end gap-2 mb-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
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

    <div className={`flex flex-col gap-0.5 max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
      <div
        className={`
          px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words
          ${isMe
            ? 'bg-indigo-600 text-white rounded-br-none shadow-lg shadow-indigo-500/20'
            : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-bl-none shadow-sm'}
        `}
      >
        {msg.message}
      </div>
      <span className="text-[10px] text-slate-400 dark:text-slate-500 px-1">
        {formatMsgTime(msg.timestamp)}
      </span>
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
  const { selectedUser, messages, typingFrom, sendMessage, setTyping, currentUser } = useChat();
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeout = useRef(null);

  const conv = selectedUser ? (messages[selectedUser.uid] || []) : [];
  const isTyping = selectedUser && typingFrom.has(selectedUser.uid);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conv, isTyping]);

  // Focus input when user selected
  useEffect(() => {
    if (selectedUser) inputRef.current?.focus();
  }, [selectedUser]);

  const handleSend = useCallback(() => {
    if (!input.trim() || !selectedUser) return;
    sendMessage(input);
    setInput('');
    setTyping(false);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
  }, [input, selectedUser, sendMessage, setTyping]);

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
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 h-full">
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
          <h2 className="font-semibold text-slate-900 dark:text-white truncate text-sm">
            {selectedUser.name}
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
                className="text-xs text-emerald-500 font-medium"
              >
                Online
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800
                           text-slate-500 dark:text-slate-400 transition-colors">
          <MoreVertical className="w-5 h-5" />
        </button>
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
                />
              );
            })}
          </>
        )}

        {isTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input Bar */}
      <div className="flex-shrink-0 px-4 py-3
                      bg-white dark:bg-slate-900
                      border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-end gap-2 relative">
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
