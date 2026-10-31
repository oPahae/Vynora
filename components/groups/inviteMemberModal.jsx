import VerifiedBadge from '@/components/shared/verifiedBadge';
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, Search, UserPlus, Check } from 'lucide-react';
import Avatar from '@/components/shared/avatar';
import { useToast } from '@/lib/toastContext';

import { t } from '@/lib/i18n/runtime';
const DEBOUNCE_MS = 300;

// Permet a un admin/owner d'un groupe d'inviter N'IMPORTE QUEL utilisateur
// (ami ou non) : recherche globale de personnes, puis ajout direct au
// groupe (voir /api/groups/[id]/invite).
export default function InviteMemberModal({ groupId, existingMemberIds = [], onClose, onInvited }) {
  const { showToast } = useToast();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [invitedIds, setInvitedIds] = useState(new Set());
  const [invitingId, setInvitingId] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = term.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsSearching(false);
      return undefined;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&type=users&limit=15`);
        const data = await response.json();
        setResults(data.success ? data.users : []);
      } finally {
        setIsSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [term]);

  async function handleInvite(targetUser) {
    setInvitingId(targetUser.id);
    try {
      const response = await fetch(`/api/groups/${groupId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetUser.id })
      });
      const data = await response.json();
      if (data.success) {
        setInvitedIds((prev) => new Set(prev).add(targetUser.id));
        showToast({ title: t("Invitation envoyee a {firstName}", { firstName: targetUser.firstName }), type: 'success' });
        if (onInvited) onInvited(targetUser);
      } else {
        showToast({ title: t("Erreur"), message: data.message, type: 'error' });
      }
    } finally {
      setInvitingId(null);
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
        className="nx-pop rounded-b-none sm:rounded-b-xl3 w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="font-display text-lg font-semibold text-slate-900 flex items-center gap-2">
            <UserPlus size={18} className="text-brand-500" />{' '}{t("Inviter des personnes")}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b border-slate-100 shrink-0">
          <div className="relative">
            <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              autoFocus
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder={t("Rechercher une personne (amis ou non)...")}
              className="w-full bg-slate-100 focus:bg-surface text-sm rounded-xl2 ps-9 pe-3 py-2.5 border border-transparent focus:border-brand-200 focus:outline-none focus:ring-2 focus:ring-brand-100 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {isSearching && (
            <div className="flex justify-center py-8">
              <Loader2 size={18} className="animate-spin text-brand-400" />
            </div>
          )}

          {!isSearching && term.trim().length >= 2 && results.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">{t("Aucune personne trouvee.")}</p>
          )}

          {!isSearching &&
            results.map((person) => {
              const alreadyMember = existingMemberIds.includes(person.id);
              const justInvited = invitedIds.has(person.id);
              return (
                <div key={person.id} className="flex items-center gap-3 px-2 py-2 rounded-xl2 hover:bg-slate-50">
                  <Avatar src={person.avatar} firstName={person.firstName} lastName={person.lastName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {person.firstName} {person.lastName}{person.verified && <VerifiedBadge size={14} />}
                    </p>
                  </div>
                  {alreadyMember ? (
                    <span className="text-xs text-slate-400 shrink-0">{t("Deja membre")}</span>
                  ) : justInvited ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 shrink-0">
                      <Check size={13} />{' '}{t("Ajoute")}</span>
                  ) : (
                    <button
                      onClick={() => handleInvite(person)}
                      disabled={invitingId === person.id}
                      className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-white bg-brand-500 hover:shadow-glow disabled:opacity-60 px-3 py-1.5 rounded-xl2 transition-all"
                    >
                      {invitingId === person.id ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}{t("Inviter")}</button>
                  )}
                </div>
              );
            })}
        </div>
      </motion.div>
    </motion.div>
  );
}
