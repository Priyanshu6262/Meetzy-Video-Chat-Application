import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Video, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ChatProvider, useChat } from '../context/ChatContext';
import ChatSidebar from '../components/chat/ChatSidebar';
import ChatWindow from '../components/chat/ChatWindow';
import AddUserModal from '../components/chat/AddUserModal';

// Inner component that uses ChatContext
const ChatLayout = () => {
  const navigate = useNavigate();
  const { selectedUser, selectUser } = useChat();
  // Mobile view: 'sidebar' or 'window'
  const [mobileView, setMobileView] = useState('sidebar');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);

  const handleSelectUser = (user) => {
    selectUser(user);
    setMobileView('window');
  };

  const handleBack = () => {
    setMobileView('sidebar');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950">
      
      <AddUserModal isOpen={isAddUserOpen} onClose={() => setIsAddUserOpen(false)} />

      {/* ── Sidebar ─────────────────────────────────────────── */}
      {/* Desktop: always visible. Mobile: shown when mobileView === 'sidebar' */}
      <div className={`
        flex-shrink-0 w-80 h-full
        ${mobileView === 'sidebar' ? 'flex' : 'hidden'}
        md:flex flex-col
      `}>
        {/* Sidebar top-bar with back-to-home */}
        <div className="flex items-center justify-between px-4 py-3
                        bg-white dark:bg-slate-900
                        border-b border-slate-200 dark:border-slate-800
                        border-r border-r-slate-200 dark:border-r-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800
                         text-slate-600 dark:text-slate-300 transition-colors"
              title="Back to Home"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5">
              <div className="bg-indigo-600 p-1 rounded-md">
                <Video className="w-4 h-4 text-white" />
              </div>
              <span className="text-base font-bold text-slate-900 dark:text-white">Meetzy</span>
            </div>
          </div>
          
          <button
            onClick={() => setIsAddUserOpen(true)}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800
                       text-slate-600 dark:text-slate-300 transition-colors"
            title="Add User"
          >
            <UserPlus className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden border-r border-slate-200 dark:border-slate-800">
          <ChatSidebar
            onSelectUser={handleSelectUser}
            onClose={handleBack}
          />
        </div>
      </div>

      {/* ── Chat Window ──────────────────────────────────────── */}
      <div className={`
        flex-1 h-full flex flex-col
        ${mobileView === 'window' ? 'flex' : 'hidden'}
        md:flex
      `}>
        <ChatWindow onBackClick={handleBack} />
      </div>

    </div>
  );
};

// ChatPage wraps the layout with ChatProvider
const ChatPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center
                      bg-white dark:bg-slate-950 gap-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center px-8 py-12 bg-white dark:bg-slate-900
                     rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-sm"
        >
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl font-black text-white">M</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Login Required
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
            You need to be logged in to access the chat.
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700
                       text-white rounded-xl font-medium transition-colors"
          >
            Go to Home
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50"
      >
        <ChatProvider>
          <ChatLayout />
        </ChatProvider>
      </motion.div>
    </AnimatePresence>
  );
};

export default ChatPage;
