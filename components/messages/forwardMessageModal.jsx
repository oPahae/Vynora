import VerifiedBadge from '@/components/shared/verifiedBadge';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, Forward, Check } from 'lucide-react';
import Avatar from '@/components/shared/avatar';
import { useToast } from '@/lib/toastContext';

import { t } from '@/lib/i18n/runtime';
export default function ForwardMessageModal({ messageId, onClose, onForwarded }) {
  const { showToast } = useToast();
  const [friends, setFriends] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    fetch('/api/friends')
      .then((response) => response.json())
      .then((data) => setFriends(data.success ? data.items || [] : []))
      .finally(() => setIsLoading(false));
  }, []);

  function toggleFriend(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleForward() {
    if (selectedIds.size === 0) return;
    setIsSending(true);
    try {
      const response = await fetch(`/api/messages/${messageId}/forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserIds: Array.from(selectedIds) })
      });
      const data = await response.json();
      if (data.success) {
        if (onForwarded) onForwarded(data.messages);
        onClose();
      } else {
        showToast({ title: t("Erreur"), message: data.message, type: 'error' });
      }
    } finally {
      setIsSending(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 nx-scrim flex items-end sm:items-center justify-center p-0 sm:p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        className="nx-pop rounded-b-none sm:rounded-b-xl3 w-full max-w-sm max-h-[75vh] flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h3 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2">
            <Forward size={17} className="text-brand-500" />{' '}{t("Transferer a...")}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={19} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={18} className="animate-spin text-brand-400" />
            </div>
          ) : friends.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">{t("Aucun ami pour le moment.")}</p>
          ) : (
            friends.map((friend) => {
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

        <div className="p-3 border-t border-slate-100 shrink-0">
          <button
            onClick={handleForward}
            disabled={selectedIds.size === 0 || isSending}
            className="nx-btn-primary w-full h-11"
          >
            {isSending && <Loader2 size={15} className="animate-spin" />}{t("Transferer")}{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
