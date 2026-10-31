import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Bell, CheckCircle2, AlertTriangle, MessageCircle } from 'lucide-react';
import { useToast } from '@/lib/toastContext';
import Avatar from '@/components/shared/avatar';

import { t } from '@/lib/i18n/runtime';
// `rgb` est un triplet utilisable dans rgb(<triplet> / alpha) : les couleurs de
// marque suivent le theme (var CSS), les couleurs d'etat sont fixes.
const TYPE_META = {
  info: { icon: Bell, rgb: 'var(--brand-600)' },
  success: { icon: CheckCircle2, rgb: '16 185 129' },
  error: { icon: AlertTriangle, rgb: '245 71 106' },
  message: { icon: MessageCircle, rgb: 'var(--brand-600)' }
};

function ToastCard({ toast, onClose }) {
  const meta = TYPE_META[toast.type] || TYPE_META.info;
  const Icon = meta.icon;
  const color = `rgb(${meta.rgb})`;

  const content = (
    <div className="relative flex items-start gap-3 nx-pop !rounded-2xl p-3.5 pe-10 w-full md:w-[22rem] overflow-hidden pointer-events-auto">
      {/* Liseré lumineux a la couleur du message */}
      <span aria-hidden className="absolute inset-y-0 start-0 w-[3px]" style={{ background: color, boxShadow: `0 0 16px 1px rgb(${meta.rgb} / 0.7)` }} />
      {toast.avatar ? (
        <Avatar src={toast.avatar} firstName={toast.title} size="sm" />
      ) : (
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `rgb(${meta.rgb} / 0.14)`, color, boxShadow: `inset 0 0 0 1px rgb(${meta.rgb} / 0.28)` }}
        >
          <Icon size={17} />
        </span>
      )}
      <div className="min-w-0 pt-0.5">
        {toast.title && <p className="text-sm font-semibold text-slate-900 truncate">{toast.title}</p>}
        {toast.message && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{toast.message}</p>}
      </div>

      <button
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }}
        className="absolute top-2.5 end-2.5 text-slate-300 hover:text-slate-600 transition-colors"
        aria-label={t("Fermer")}
      >
        <X size={15} />
      </button>

      <div className="absolute bottom-0 start-0 end-0 h-[2px] bg-slate-100/60">
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: toast.duration / 1000, ease: 'linear' }}
          style={{ transformOrigin: 'left', background: color }}
          className="h-full"
        />
      </div>
    </div>
  );

  if (toast.href) {
    return (
      <Link href={toast.href} onClick={onClose}>
        {content}
      </Link>
    );
  }

  return content;
}

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] md:bottom-6 inset-x-4 md:inset-x-auto md:end-6 z-[100] flex flex-col-reverse items-stretch md:items-end gap-2.5 pointer-events-none">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 28, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.16 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            // Glisser sur le cote pour fermer : le geste naturel sur mobile.
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            onDragEnd={(_, info) => {
              if (Math.abs(info.offset.x) > 90 || Math.abs(info.velocity.x) > 500) removeToast(toast.id);
            }}
            className="touch-pan-y"
          >
            <ToastCard toast={toast} onClose={() => removeToast(toast.id)} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
