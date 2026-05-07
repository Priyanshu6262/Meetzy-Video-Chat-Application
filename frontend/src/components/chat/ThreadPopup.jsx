import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Reply } from 'lucide-react';
import { useChat } from '../../context/ChatContext';

const formatMsgTime = (ts) => {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const ThreadPopup = ({ isOpen, onClose, threadId }) => {
  const { threadData, getThread, sendMessage, currentUser } = useChat();
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    if (isOpen && threadId) {
      getThread(threadId);
    }
  }, [isOpen, threadId, getThread]);

  const messages = threadData[threadId] || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen || !threadId) return null;

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    // Sending a message directly into the thread
    // The parent message is threadId
    sendMessage(input.trim(), threadId);
    setInput('');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-y-0 right-0 z-[100] w-full sm:w-[400px] flex">
        {/* Backdrop for mobile to close */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/60 sm:hidden backdrop-blur-sm -z-10"
          onClick={onClose}
        />
        
        {/* Panel */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="w-full h-full bg-slate-50 dark:bg-slate-950 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">Thread</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {messages.length > 0 ? `${messages.length - 1} Replies` : 'Loading...'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
            {messages.map((msg, idx) => {
              const isRoot = idx === 0;
              const isMe = msg.from === currentUser?.uid;

              return (
                <div key={msg.id || idx} className={`flex flex-col ${isRoot ? 'mb-6' : 'pl-4 border-l-2 border-slate-200 dark:border-slate-800'}`}>
                  {isRoot && (
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1 border-t border-slate-200 dark:border-slate-800" />
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Original Message</span>
                      <div className="flex-1 border-t border-slate-200 dark:border-slate-800" />
                    </div>
                  )}

                  <div className={`flex items-start gap-3 ${isRoot ? '' : 'mt-2'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                          {isMe ? 'You' : msg.senderName}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatMsgTime(msg.timestamp)}
                        </span>
                      </div>
                      
                      <div className={`inline-block px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words
                                     ${isMe ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-tl-none shadow-sm'}`}>
                        {msg.message}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
            <form onSubmit={handleSend} className="flex items-end gap-2">
              <div className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-1 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500 transition-all flex">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Reply in thread..."
                  className="w-full bg-transparent border-none focus:ring-0 text-slate-900 dark:text-white placeholder-slate-400 text-sm py-2 px-3 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={!input.trim()}
                className="p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm shadow-indigo-500/25 flex-shrink-0"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ThreadPopup;
