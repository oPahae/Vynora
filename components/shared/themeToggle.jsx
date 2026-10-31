import { AnimatePresence, motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/lib/themeContext';

import { t } from '@/lib/i18n/runtime';

// Bouton clair / sombre : le soleil et la lune se relaient en pivotant.
// Le changement lui-meme est revele par une onde circulaire (voir themeContext).
export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const label = isDark ? t('Clair') : t('Sombre');
  return (
    <button type="button" onClick={toggleTheme} className={`nx-icon-btn relative overflow-hidden ${className}`} title={label} aria-label={label}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? 'moon' : 'sun'}
          initial={{ rotate: -80, scale: 0.4, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 80, scale: 0.4, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 24 }}
          className="flex"
        >
          {isDark ? <Moon size={18} /> : <Sun size={18} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
