import VerifiedBadge from '@/components/shared/verifiedBadge';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Crown } from 'lucide-react';
import Avatar from '@/components/shared/avatar';

import { t } from '@/lib/i18n/runtime';
// Liste des membres du serveur groupes par role (le plus haut d'abord),
// avec recherche par nom. `refreshKey` force un rechargement (nouveau
// membre, roles modifies...).
export default function MemberList({ guildId, refreshKey, onClose, onSelectMember }) {
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const debounceRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/guilds/${guildId}/members?q=${encodeURIComponent(search)}`);
        const data = await response.json();
        if (!cancelled && data.success) setMembers(data.members);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, search ? 250 : 0);
    return () => {
      cancelled = true;
      clearTimeout(debounceRef.current);
    };
  }, [guildId, search, refreshKey]);

  // Les membres arrivent deja tries : on cree un groupe a chaque changement
  // de role principal.
  const groups = useMemo(() => {
    const result = [];
    members.forEach((member) => {
      const key = member.isOwner ? 'owner' : member.topRole ? t("role-{id}", { id: member.topRole.id }) : 'none';
      const label = member.isOwner ? t("Proprietaire") : member.topRole ? member.topRole.name : t("Membres");
      let group = result[result.length - 1];
      if (!group || group.key !== key) {
        group = { key, label, members: [] };
        result.push(group);
      }
      group.members.push(member);
    });
    return result;
  }, [members]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-4 h-14 shrink-0 border-b border-slate-100">
        <h3 className="font-display font-semibold text-slate-900 text-sm">{t("Membres ({length})", { length: members.length })}</h3>
        {onClose && (
          <button type="button" onClick={onClose} className="lg:hidden p-1.5 text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        )}
      </div>

      <div className="px-3 py-2 shrink-0">
        <div className="flex items-center gap-2 bg-slate-50 rounded-xl2 px-3 py-2 border border-slate-100 focus-within:border-brand-300">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Rechercher un membre")}
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {!isLoading && members.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">{t("Aucun membre trouve.")}</p>
        )}
        {groups.map((group) => (
          <div key={group.key} className="mb-3">
            <p className="px-2 py-1.5 text-[11px] font-semibold  text-slate-400">
              {group.label} - {group.members.length}
            </p>
            {group.members.map((member) => (
              <button
                type="button"
                key={member.id}
                onClick={() => onSelectMember && onSelectMember(member)}
                className="w-full text-start flex items-center gap-2.5 px-2 py-1.5 rounded-xl2 hover:bg-slate-50"
              >
                <Avatar src={member.avatar} firstName={member.firstName} lastName={member.lastName} size="sm" />
                <span
                  className="text-sm font-medium truncate"
                  style={{ color: member.topRole?.color || undefined }}
                >
                  {member.firstName} {member.lastName}{member.verified && <VerifiedBadge size={14} />}
                </span>
                {member.isOwner && <Crown size={13} className="text-amber-500 shrink-0" />}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
