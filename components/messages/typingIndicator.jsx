import { motion } from 'framer-motion';

import { t } from '@/lib/i18n/runtime';
// "Quelqu'un ecrit" : trois points qui ondulent dans une petite bulle de verre,
// avec le meme rythme que les vraies bulles (entree en ressort).
export default function TypingIndicator({ name }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      className="flex items-center gap-2 px-4 py-1.5 text-xs text-slate-400"
    >
      <span className="flex items-center gap-1 rounded-full rounded-es-md px-3 py-2 nx-bubble-other" aria-hidden>
        {[0, 1, 2].map((dot) => (
          <motion.span
            key={dot}
            className="w-1.5 h-1.5 rounded-full bg-brand-400"
            animate={{ y: [0, -4, 0], opacity: [0.45, 1, 0.45] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: dot * 0.15, ease: 'easeInOut' }}
          />
        ))}
      </span>
      <span>{t("{name} ecrit", { name })}</span>
    </motion.div>
  );
}
