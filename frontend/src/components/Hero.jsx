import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import InlineVideoChat from './InlineVideoChat';

const Hero = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [isMeetingActive, setIsMeetingActive] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState('');

  const handleStartChat = () => {
    if (!currentUser) {
      alert('Please login to create a meeting.');
      return;
    }
    const newRoomId = Math.random().toString(36).substring(2, 8);
    setActiveRoomId(newRoomId);
    setIsMeetingActive(true);
  };

  const handleJoinMeeting = (e) => {
    e.preventDefault();
    if (!currentUser) {
      alert('Please login to join a meeting.');
      return;
    }
    if (joinCode.trim()) {
      setActiveRoomId(joinCode.trim());
      setIsMeetingActive(true);
      setIsJoinModalOpen(false);
    }
  };

  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 blur-3xl rounded-full"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 blur-3xl rounded-full"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <AnimatePresence mode="wait">
          {isMeetingActive ? (
            <motion.div
              key="video-chat"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.5 }}
              className="mt-4 mb-16"
            >
              <InlineVideoChat roomId={activeRoomId} onClose={() => setIsMeetingActive(false)} />
            </motion.div>
          ) : (
            <motion.div
              key="hero-content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6 }}
            >
          <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-sm font-semibold mb-6 border border-indigo-100 dark:border-indigo-800">
            Secure • Reliable • Fast
          </span>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-6 leading-[1.1]">
            Connect with anyone, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">
              anywhere in the world.
            </span>
          </h1>
          
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-10 leading-relaxed">
            Experience high-quality video calls, instant messaging, and seamless screen sharing. Built for teams that value privacy and performance.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={handleStartChat}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg transition-all shadow-xl shadow-indigo-500/25 group active:scale-95"
            >
              Create Meeting <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={() => setIsJoinModalOpen(true)}
              className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl font-bold text-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
            >
              Join Meeting
            </button>
          </div>
        </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isMeetingActive && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-20 relative mx-auto max-w-5xl"
        >
          <div className="p-8 md:p-12 bg-indigo-600 rounded-[3rem] text-center text-white relative overflow-hidden shadow-2xl shadow-indigo-500/40">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <h3 className="text-3xl md:text-4xl font-bold mb-6">Ready to experience Meetzy?</h3>
            <p className="text-indigo-100 mb-10 text-lg max-w-xl mx-auto">
              Join thousands of teams already using Meetzy for their daily collaboration needs.
            </p>
            <button
              onClick={() => navigate('/chat')}
              className="px-10 py-4 bg-white text-indigo-600 rounded-2xl font-bold text-lg hover:bg-indigo-50 transition-colors shadow-lg active:scale-95"
            >
              Start Chat
            </button>
          </div>
        </motion.div>
        )}
      </AnimatePresence>
      </div>

      {/* Join Meeting Modal */}
      <AnimatePresence>
        {isJoinModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsJoinModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
            >
              <div className="p-6 sm:p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Join Meeting</h2>
                  <button 
                    onClick={() => setIsJoinModalOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <form onSubmit={handleJoinMeeting} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Meeting Code
                    </label>
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      placeholder="e.g. abc-defg-hij"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/25 active:scale-95"
                  >
                    Join Now
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </section>
  );
};

export default Hero;
