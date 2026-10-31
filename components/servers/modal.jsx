import { X } from 'lucide-react';

import { t } from '@/lib/i18n/runtime';
// Fenetre modale : feuille pleine largeur collee en bas sur mobile,
// boite centree sur ecran large.
export default function Modal({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <button type="button" aria-label={t("Fermer")} onClick={onClose} className="absolute inset-0 nx-scrim" />
      <div className="relative w-full sm:max-w-md nx-pop rounded-b-none sm:rounded-b-xl3 max-h-[90dvh] animate-sheet-up sm:animate-pop-in flex flex-col pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-display font-semibold text-slate-900 truncate">{title}</h3>
          <button type="button" onClick={onClose} className="p-1.5 -me-1.5 text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 space-y-4">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export const inputClasses =
  'nx-field';
export const primaryButton =
  'nx-btn-primary';
export const ghostButton = 'nx-btn-ghost';
