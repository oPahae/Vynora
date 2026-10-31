import { useState } from 'react';
import { UserPlus, UserCheck, Clock, Check, X, Loader2 } from 'lucide-react';
import { useConfirm } from '@/lib/confirmContext';

import { t } from '@/lib/i18n/runtime';
export default function FriendButton({ userId, status, onStatusChange, size = 'md' }) {
  const sm = size === 'sm';
  const sz = sm ? '!h-8 !px-2.5 !text-xs !rounded-xl' : '';
  const [isLoading, setIsLoading] = useState(false);
  const confirm = useConfirm();

  async function callAction(action, method = 'POST') {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/friends/${userId}/${action}`, { method });
      const data = await response.json();
      if (data.success) {
        onStatusChange(userId, data.status);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUnfriend() {
    const confirmed = await confirm({
      title: t("Retirer cet ami ?"),
      message: t("Vous ne serez plus amis. Vous pourrez toujours lui renvoyer une demande plus tard."),
      confirmLabel: t("Retirer"),
      danger: true
    });
    if (confirmed) callAction('remove', 'DELETE');
  }

  if (status === 'friends') {
    return (
      <button
        onClick={handleUnfriend}
        disabled={isLoading}
        className={`nx-btn-secondary ${sz} hover:!bg-red-50 hover:!text-red-600`}
      >
        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <UserCheck size={16} />}{t("Amis")}</button>
    );
  }

  if (status === 'requestSent') {
    return (
      <button
        onClick={() => callAction('cancel')}
        disabled={isLoading}
        className={`nx-btn-secondary ${sz}`}
      >
        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Clock size={16} />}{t("Invitation envoyee")}</button>
    );
  }

  if (status === 'requestReceived') {
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => callAction('accept')}
          disabled={isLoading}
          className={`nx-btn-primary ${sz}`}
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}{t("Accepter")}</button>
        <button
          onClick={() => callAction('reject')}
          disabled={isLoading}
          className={`nx-btn-secondary ${sz}`}
        >
          <X size={16} />{' '}{t("Refuser")}</button>
      </div>
    );
  }

  return (
    <button
      onClick={() => callAction('request')}
      disabled={isLoading}
      className={`nx-btn-primary ${sz}`}
      title={t("Ajouter")}
      aria-label={t("Ajouter")}
    >
      {isLoading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}<span className={sm ? 'sr-only' : ''}>{t("Ajouter")}</span></button>
  );
}
