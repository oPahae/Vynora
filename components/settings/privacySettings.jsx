import { useState, useEffect } from 'react';
import { ShieldOff, Lock, Loader2, Radio, CheckCheck } from 'lucide-react';
import FriendCard from '@/components/friends/friendCard';
import { useAuth } from '@/lib/authContext';

import { t } from '@/lib/i18n/runtime';
export default function PrivacySettings() {
  const { user, updateUser } = useAuth();
  const [isPrivate, setIsPrivate] = useState(Boolean(user?.isPrivate));
  const [showOnlineStatus, setShowOnlineStatus] = useState(user?.showOnlineStatus !== false);
  const [showReadReceipts, setShowReadReceipts] = useState(user?.showReadReceipts !== false);
  const [isSaving, setIsSaving] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [isLoadingBlocked, setIsLoadingBlocked] = useState(true);

  useEffect(() => {
    fetch('/api/block')
      .then((response) => response.json())
      .then((data) => setBlockedUsers(data.success ? data.items : []))
      .finally(() => setIsLoadingBlocked(false));
  }, []);

  async function togglePrivate() {
    const next = !isPrivate;
    setIsPrivate(next);
    setIsSaving(true);
    try {
      await fetch('/api/users/me/privacy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPrivate: next })
      });
      updateUser({ isPrivate: next });
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleShowOnlineStatus() {
    const next = !showOnlineStatus;
    setShowOnlineStatus(next);
    setIsSaving(true);
    try {
      await fetch('/api/users/me/privacy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showOnlineStatus: next })
      });
      // Reconnecte le socket avec le nouveau reglage : met immediatement a
      // jour ce que je vois et ce que les autres voient de moi.
      updateUser({ showOnlineStatus: next });
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleShowReadReceipts() {
    const next = !showReadReceipts;
    setShowReadReceipts(next);
    setIsSaving(true);
    try {
      await fetch('/api/users/me/privacy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showReadReceipts: next })
      });
      updateUser({ showReadReceipts: next });
    } finally {
      setIsSaving(false);
    }
  }

  function handleUnblock(userId) {
    fetch(`/api/block/${userId}`, { method: 'DELETE' }).then(() => {
      setBlockedUsers((prev) => prev.filter((item) => item.id !== userId));
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-semibold text-slate-900 tracking-tight flex items-center gap-2 mb-3">
          <Lock size={16} />{' '}{t("Confidentialite du compte")}</h3>
        <label className="flex items-center justify-between gap-4 bg-slate-50 rounded-xl2 px-4 py-3.5 cursor-pointer">
          <div>
            <p className="text-sm font-medium text-slate-800">{t("Compte prive")}</p>
            <p className="text-xs text-slate-500 mt-0.5">{t("Vos publications publiques ne seront visibles que par vos amis.")}</p>
          </div>
          <div className="relative shrink-0">
            <input type="checkbox" checked={isPrivate} onChange={togglePrivate} className="sr-only peer" />
            <div className="w-11 h-6 bg-slate-300 rounded-full peer-checked:bg-brand-500 transition-colors" />
            <div className="absolute top-0.5 start-0.5 w-5 h-5 bg-surface rounded-full transition-transform peer-checked:translate-x-5" />
          </div>
        </label>
        {isSaving && <p className="text-xs text-slate-400 mt-1.5">{t("Enregistrement...")}</p>}
      </div>

      <div>
        <h3 className="font-display font-semibold text-slate-900 tracking-tight flex items-center gap-2 mb-3">
          <Radio size={16} />{' '}{t("Statut en ligne")}</h3>
        <label className="flex items-center justify-between gap-4 bg-slate-50 rounded-xl2 px-4 py-3.5 cursor-pointer">
          <div>
            <p className="text-sm font-medium text-slate-800">{t("Afficher mon statut en ligne")}</p>
            <p className="text-xs text-slate-500 mt-0.5">{t("Si vous desactivez cette option, les autres ne verront plus quand vous etes en ligne, et vous ne verrez plus non plus le statut en ligne des autres.")}</p>
          </div>
          <div className="relative shrink-0">
            <input
              type="checkbox"
              checked={showOnlineStatus}
              onChange={toggleShowOnlineStatus}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-300 rounded-full peer-checked:bg-brand-500 transition-colors" />
            <div className="absolute top-0.5 start-0.5 w-5 h-5 bg-surface rounded-full transition-transform peer-checked:translate-x-5" />
          </div>
        </label>
      </div>

      <div>
        <h3 className="font-display font-semibold text-slate-900 tracking-tight flex items-center gap-2 mb-3">
          <CheckCheck size={16} />{' '}{t("Accuses de lecture")}</h3>
        <label className="flex items-center justify-between gap-4 bg-slate-50 rounded-xl2 px-4 py-3.5 cursor-pointer">
          <div>
            <p className="text-sm font-medium text-slate-800">{t("Afficher mes accuses de lecture")}</p>
            <p className="text-xs text-slate-500 mt-0.5">{t("Si vous desactivez cette option, vos interlocuteurs ne sauront plus quand vous avez lu leurs messages, et vous ne verrez plus non plus leurs accuses de lecture.")}</p>
          </div>
          <div className="relative shrink-0">
            <input
              type="checkbox"
              checked={showReadReceipts}
              onChange={toggleShowReadReceipts}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-300 rounded-full peer-checked:bg-brand-500 transition-colors" />
            <div className="absolute top-0.5 start-0.5 w-5 h-5 bg-surface rounded-full transition-transform peer-checked:translate-x-5" />
          </div>
        </label>
      </div>

      <div>
        <h3 className="font-display font-semibold text-slate-900 tracking-tight flex items-center gap-2 mb-3">
          <ShieldOff size={16} />{' '}{t("Utilisateurs bloques")}</h3>

        {isLoadingBlocked ? (
          <div className="flex justify-center py-6">
            <Loader2 size={18} className="animate-spin text-brand-400" />
          </div>
        ) : blockedUsers.length === 0 ? (
          <p className="text-sm text-slate-400">{t("Vous n'avez bloque personne.")}</p>
        ) : (
          <div className="space-y-2">
            {blockedUsers.map((item) => (
              <FriendCard
                key={item.id}
                user={item}
                actions={
                  <button
                    onClick={() => handleUnblock(item.id)}
                    className="nx-btn-secondary nx-btn-sm"
                  >
                    <ShieldOff size={13} />{' '}{t("Debloquer")}</button>
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
