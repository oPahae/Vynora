import { Phone, Video } from 'lucide-react';
import { useCall } from '@/lib/callContext';

import { t } from '@/lib/i18n/runtime';
// Boutons d'appel vocal / video affiches dans l'en-tete d'une conversation.
export default function CallButtons({ conversationId, otherUser, isOnline, isBlocked }) {
  const { startCall, isInCall } = useCall();

  let hint = '';
  if (isBlocked) hint = t("Appel impossible : utilisateur bloque");
  else if (isInCall) hint = t("Vous etes deja en communication");
  else if (!isOnline) hint = t("{firstName} est hors ligne", { firstName: otherUser.firstName });

  const disabled = Boolean(hint);
  const buttonClasses =
    'w-9 h-9 rounded-full flex items-center justify-center text-slate-500 transition-colors hover:bg-brand-50 hover:text-brand-600 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-500 disabled:cursor-not-allowed';

  return (
    <div className="ms-auto flex items-center gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={() => startCall(otherUser, conversationId, 'voice')}
        aria-label={t("Appel vocal")}
        title={hint || t("Appel vocal")}
        className={buttonClasses}
      >
        <Phone size={18} />
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => startCall(otherUser, conversationId, 'video')}
        aria-label={t("Appel video")}
        title={hint || t("Appel video")}
        className={buttonClasses}
      >
        <Video size={18} />
      </button>
    </div>
  );
}
