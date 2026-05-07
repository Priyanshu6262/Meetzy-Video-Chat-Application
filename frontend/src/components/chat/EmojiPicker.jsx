import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EMOJIS = [
  '😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊',
  '😋','😎','😍','🥰','😘','😗','😙','😚','🙂','🤗',
  '🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯',
  '😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤯',
  '🤠','🥳','😷','🤒','🤕','🤑','🤧','😈','👿','👹',
  '💀','☠️','💩','🤡','👻','👽','🙈','🙉','🙊','💋',
  '💔','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎',
  '💯','💢','💥','💫','💦','💨','🕳️','💬','💭','👋',
  '🤚','🖐️','✋','🤙','👍','👎','✊','👊','🤛','🤜',
  '🤞','✌️','🤟','🤘','👌','🤌','🤏','👈','👉','👆',
  '🖕','👇','☝️','👏','🙌','🤲','🤝','🙏','✍️','💅',
  '🦾','🦿','💪','🦵','🦶','👂','🦻','👃','🫀','🫁',
  '🧠','🦷','🦴','👀','👁️','👅','👄','🫦','🐶','🐱',
  '🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮',
  '🐷','🐸','🐵','🐔','🐧','🐦','🦅','🦆','🦉','🦇',
  '🌸','🌺','🌻','🌹','🌷','🌱','🌿','🍀','🍁','🍂',
  '🍎','🍊','🍋','🍇','🍓','🍒','🥭','🍑','🥝','🍕',
  '🍔','🍟','🌭','🍿','🧂','🥓','🥚','🍳','🧇','🥞',
  '🎉','🎊','🎈','🎁','🎀','🎗️','🎟️','🎫','🏆','🥇',
  '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🎱','🏓',
  '🚀','✈️','🚂','🚗','🚕','🚙','🚌','🚎','🏎️','🛸',
  '⌚','📱','💻','⌨️','🖥️','🖨️','🖱️','🕹️','💾','💿',
  '🌍','🌎','🌏','🗺️','🧭','🏔️','❄️','☀️','🌤️','⛅',
  '🌦️','🌧️','⛈️','🌩️','🌨️','🌪️','🌊','🔥','💧','🌈',
];

const EmojiPicker = ({ onSelect, isOpen, onClose }) => {
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, scale: 0.92, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 8 }}
          transition={{ duration: 0.15 }}
          className="absolute bottom-16 left-0 z-50 w-72 max-h-56 overflow-y-auto
                     bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
                     rounded-2xl shadow-2xl p-3"
        >
          <div className="grid grid-cols-8 gap-0.5">
            {EMOJIS.map((emoji, i) => (
              <button
                key={i}
                onClick={() => { onSelect(emoji); onClose(); }}
                className="text-xl p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700
                           transition-colors leading-none flex items-center justify-center"
              >
                {emoji}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EmojiPicker;
