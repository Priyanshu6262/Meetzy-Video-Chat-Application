import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Tag, AtSign, Save } from 'lucide-react';
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

const ProfileSettingsModal = ({ isOpen, onClose, user }) => {
  const { updateContactSettings } = useChat();
  
  const [customName, setCustomName] = useState('');
  const [nickname, setNickname] = useState('');
  const [customLabel, setCustomLabel] = useState('');

  useEffect(() => {
    if (user && isOpen) {
      // Initialize with current settings or defaults
      // We stored originalName in the server response specifically for this
      setCustomName(user.name !== user.originalName ? user.name : '');
      setNickname(user.nickname || '');
      setCustomLabel(user.customLabel || '');
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleSave = (e) => {
    e.preventDefault();
    updateContactSettings({
      targetUid: user.uid,
      // If customName is blank, we can send '' so it reverts to originalName
      customName: customName.trim(),
      nickname: nickname.trim(),
      customLabel: customLabel.trim()
    });
    onClose();
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
          <div className="relative h-32 bg-gradient-to-r from-indigo-500 to-purple-600 flex-shrink-0">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Profile Section */}
          <div className="px-6 pb-6 relative flex-1 overflow-y-auto scrollbar-thin">
            <div className="flex flex-col items-center -mt-10 mb-6">
              <Avatar src={user.photo} name={user.originalName || user.name} size="lg" />
              <h2 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">
                {user.originalName || user.name}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {user.email}
              </p>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">
                  Custom Contact Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="w-5 h-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder={user.originalName || "Enter custom name"}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                  />
                </div>
                <p className="text-xs text-slate-500 ml-1">This overrides their name in your chat list.</p>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">
                  Chat Nickname
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <AtSign className="w-5 h-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="e.g. Bestie, Boss, etc."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">
                  Custom Profile Label
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Tag className="w-5 h-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder="e.g. Co-worker, Family"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors shadow-sm shadow-indigo-500/25"
                >
                  <Save className="w-5 h-5" />
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ProfileSettingsModal;
