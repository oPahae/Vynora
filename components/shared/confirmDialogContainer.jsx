import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { useConfirmState } from '@/lib/confirmContext';

export default function ConfirmDialogContainer() {
  const { request, onConfirm, onCancel } = useConfirmState();

  return (
    <AnimatePresence>
      {request && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 nx-scrim flex items-end sm:items-center justify-center p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] z-[200]"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="nx-pop rounded-3xl w-full max-w-sm p-6 text-center sm:text-start"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3.5">
              <span
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  request.danger ? 'bg-red-50 text-red-500 shadow-[0_8px_20px_-8px_rgb(239_68_68_/_0.5)]' : 'bg-brand-50 text-brand-600'
                }`}
              >
                {request.danger ? <AlertTriangle size={18} /> : <HelpCircle size={18} />}
              </span>
              <div className="min-w-0 pt-1">
                <h3 className="font-display text-base font-semibold text-slate-900">
                  {request.title}
                </h3>
                {request.message && (
                  <p className="text-sm text-slate-500 mt-1">{request.message}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={onCancel}
                className="nx-btn-secondary h-12 sm:h-10"
              >
                {request.cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`h-12 sm:h-10 ${request.danger ? 'nx-btn-danger' : 'nx-btn-primary'}`}
              >
                {request.confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
