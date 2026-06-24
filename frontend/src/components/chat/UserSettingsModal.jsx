import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Settings, Info } from 'lucide-react';
import { useChat } from '../../context/ChatContext';

const Avatar = ({ src, name, size = 'md' }) => {
  const dim = size === 'md' ? 'w-10 h-10' : size === 'lg' ? 'w-20 h-20 text-3xl' : 'w-8 h-8';
  const initial = (name || 'U')[0].toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${dim} rounded-full object-cover flex-shrink-0 border-4 border-white dark:border-slate-800 shadow-sm`}
        onError={e => { e.target.style.display = 'none'; }}
      />
    );
  }
  return (
    <div className={`${dim} rounded-full bg-gradient-to-br from-indigo-500 to-blue-600
                     flex items-center justify-center flex-shrink-0 border-4 border-white dark:border-slate-800 shadow-sm`}>
      <span className="font-bold text-white">{initial}</span>
    </div>
  );
};

const UserSettingsModal = ({ isOpen, onClose }) => {
  const { userPreferences, updateUserSettings, currentUser } = useChat();

  if (!isOpen || !currentUser) return null;

  const handleToggle = (checked) => {
    updateUserSettings({ aiReplySuggestions: checked });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          onClick={onClose}
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="relative h-28 bg-gradient-to-r from-indigo-500 to-purple-600 flex-shrink-0 flex items-center px-6">
            <div className="flex items-center gap-2 text-white">
              <Settings className="w-6 h-6 animate-spin-slow" />
              <h2 className="text-xl font-bold">Preferences</h2>
            </div>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Profile Summary */}
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4 bg-slate-50/50 dark:bg-slate-900/50">
            <Avatar src={currentUser.photoURL} name={currentUser.displayName || currentUser.email} size="md" />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {currentUser.displayName || currentUser.email.split('@')[0]}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {currentUser.email}
              </p>
            </div>
          </div>

          {/* Settings Options */}
          <div className="p-6 space-y-6 flex-1 overflow-y-auto scrollbar-thin">
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                AI Settings
              </h4>

              {/* Status Badges Row */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1.5 ${
                  userPreferences.geminiConnected 
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-950/50' 
                    : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-950/50'
                }`}>
                  Gemini {userPreferences.geminiConnected ? 'Connected ✅' : 'Disconnected ❌'}
                </span>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1.5 border transition-all ${
                  userPreferences.autoReplyEnabled 
                    ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-950/50' 
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${userPreferences.autoReplyEnabled ? 'bg-indigo-500 animate-pulse' : 'bg-slate-400'}`} />
                  Auto Reply {userPreferences.autoReplyEnabled ? 'Active' : 'Disabled'}
                </span>
              </div>
              
              {/* Suggestion Toggle */}
              <div className="flex items-start justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                <div className="flex gap-3">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl mt-0.5 flex-shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-900 dark:text-white select-none">
                      AI Reply Suggestions
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Analyze conversation context in active chat windows to suggest smart, ready-to-send replies in English and Hinglish.
                    </p>
                  </div>
                </div>

                {/* Custom Toggle Switch */}
                <button
                  onClick={() => handleToggle(!userPreferences.aiReplySuggestions)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                    userPreferences.aiReplySuggestions ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                  aria-label="Toggle AI Suggestions"
                >
                  <motion.div
                    layout
                    className="bg-white w-4 h-4 rounded-full shadow-sm"
                    animate={{ x: userPreferences.aiReplySuggestions ? 20 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>

              {/* Auto Reply Automation settings block */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl mt-0.5 flex-shrink-0">
                      <Settings className="w-5 h-5 animate-spin-slow" />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-slate-900 dark:text-white select-none">
                        Auto Reply Automation
                      </label>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Let Gemini AI automatically send context-aware replies to incoming messages in real-time.
                      </p>
                    </div>
                  </div>

                  {/* Toggle switch */}
                  <button
                    onClick={() => updateUserSettings({ autoReplyEnabled: !userPreferences.autoReplyEnabled })}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                      userPreferences.autoReplyEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                    aria-label="Toggle Auto Reply"
                  >
                    <motion.div
                      layout
                      className="bg-white w-4 h-4 rounded-full shadow-sm"
                      animate={{ x: userPreferences.autoReplyEnabled ? 20 : 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>

                {/* Sub-options for Language and Style (Only visible or enabled if Auto Reply is ON) */}
                <div className={`space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800 transition-all duration-200 ${
                  userPreferences.autoReplyEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'
                }`}>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Language Preference
                    </label>
                    <select
                      value={userPreferences.autoReplyLanguage || 'auto'}
                      onChange={(e) => updateUserSettings({ autoReplyLanguage: e.target.value })}
                      disabled={!userPreferences.autoReplyEnabled}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="auto">Auto Detect Language</option>
                      <option value="english">Always Reply in English</option>
                      <option value="hinglish">Always Reply in Hinglish</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Response Style
                    </label>
                    <select
                      value={userPreferences.autoReplyStyle || 'friendly'}
                      onChange={(e) => updateUserSettings({ autoReplyStyle: e.target.value })}
                      disabled={!userPreferences.autoReplyEnabled}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="friendly">Friendly (Warm & conversational)</option>
                      <option value="professional">Professional (Formal & polite)</option>
                      <option value="casual">Casual (Relaxed & direct)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-xl flex gap-3 text-xs leading-relaxed border border-indigo-100/40 dark:border-indigo-950/40">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>
                Suggestions and auto-replies are generated securely using Google Gemini. Caching and loop protection are used to conserve resources.
              </p>
            </div>
          </div>

          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm transition-colors shadow-sm"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default UserSettingsModal;
