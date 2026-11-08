import VerifiedBadge from '@/components/shared/verifiedBadge';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, Send, Check, Search } from 'lucide-react';
import Avatar from '@/components/shared/avatar';
import { useToast } from '@/lib/toastContext';
import { t, td } from '@/lib/i18n/runtime';

// Envoyer un reel a un ou plusieurs amis, en message prive.
export default function SendReelModal({ reelId, onClose }) {
  const { showToast } = useToast();
  const [friends, setFriends] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    fetch('/api/friends')
      .then((response) => response.json())
      .then((data) => setFriends(data.success ? data.items || [] : []))
      .catch(() => setFriends([]))
      .finally(() => setIsLoading(false));
  }, []);

  function toggleFriend(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 10) next.add(id);
      return next;
    });
  }

  async function handleSend() {
    if (selectedIds.size === 0) return;
    setIsSending(true);
    try {
      const response = await fetch(`/api/reels/${reelId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserIds: Array.from(selectedIds), content: message.trim() })
      });
      const data = await response.json();
      if (data.success) {
        showToast({ title: t("Reel envoye"), type: 'success', playSound: false });
        onClose();
      } else {
        showToast({ title: t("Erreur"), message: td(data.message), type: 'error', playSound: false });
      }
    } catch (error) {
      showToast({ title: t("Impossible de contacter le serveur"), type: 'error', playSound: false });
    } finally {
      setIsSending(false);
    }
  }

  const term = search.trim().toLowerCase();
  const visible = term
    ? friends.filter((friend) => `${friend.firstName} ${friend.lastName}`.toLowerCase().includes(term))
    : friends;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 nx-scrim flex items-end sm:items-center justify-center p-0 sm:p-4 z-[80]"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        className="nx-pop rounded-b-none sm:rounded-b-xl3 w-full max-w-sm max-h-[80vh] flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h3 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2">
            <Send size={17} className="text-brand-500" />{' '}{t("Envoyer en message")}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label={t("Fermer")}>
            <X size={19} />
          </button>
        </div>

        <div className="px-3 pt-3 shrink-0">
          <label className="flex items-center gap-2 bg-slate-50 rounded-xl2 px-3 h-10">
            <Search size={15} className="text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("Rechercher un ami")}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto p-2 min-h-[8rem]">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={18} className="animate-spin text-brand-400" />
            </div>
          ) : visible.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">{t("Aucun ami pour le moment.")}</p>
          ) : (
            visible.map((friend) => {
              const selected = selectedIds.has(friend.id);
              return (
                <button
                  key={friend.id}
                  type="button"
                  onClick={() => toggleFriend(friend.id)}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-xl2 hover:bg-slate-50"
                >
                  <Avatar src={friend.avatar} firstName={friend.firstName} lastName={friend.lastName} size="sm" />
                  <span className="flex-1 min-w-0 text-start text-sm font-medium text-slate-800 truncate">
                    {friend.firstName} {friend.lastName}{friend.verified && <VerifiedBadge size={14} />}
                  </span>
                  <span
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                      selected ? 'bg-brand-500 border-brand-500 text-white' : 'border-slate-300'
                    }`}
                  >
                    {selected && <Check size={12} />}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="p-3 border-t border-slate-100 shrink-0 space-y-2">
          <input
            value={message}
            maxLength={500}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t("Ajouter un message (facultatif)")}
            className="w-full h-10 rounded-xl2 bg-slate-50 px-3 text-sm outline-none focus:ring-4 focus:ring-brand-500/10"
          />
          <button onClick={handleSend} disabled={selectedIds.size === 0 || isSending} className="nx-btn-primary w-full h-11">
            {isSending && <Loader2 size={15} className="animate-spin" />}
            {t("Envoyer")}{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
