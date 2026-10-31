import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

// Fenetre modale generique (feuille en bas sur mobile, boite centree ensuite).
// A rendre dans un <AnimatePresence> pour l'animation de sortie.
export default function Modal({ title, onClose, children, maxWidth = 'max-w-lg', footer }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 nx-scrim flex items-end sm:items-center justify-center p-0 sm:p-4 z-[70]"
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        className={`nx-pop rounded-b-none sm:rounded-b-xl3 w-full ${maxWidth} max-h-[88vh] flex flex-col`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h3 className="font-display text-lg font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="nx-icon-btn w-8 h-8 text-slate-400" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-5 flex-1">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-slate-100 shrink-0">{footer}</div>}
      </motion.div>
    </motion.div>
  );
}
