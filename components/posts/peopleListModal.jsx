import VerifiedBadge from '@/components/shared/verifiedBadge';
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import Link from 'next/link';
import Avatar from '@/components/shared/avatar';

import { t } from '@/lib/i18n/runtime';
// Normalise une chaine pour une comparaison insensible aux accents/casse,
// afin que la recherche locale reste tolerante aux petites variations de
// saisie (ex: "amine" trouve "Aminé").
function normalize(text) {
  return (text || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export default function PeopleListModal({ title, people, emptyLabel, renderBadge, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPeople = useMemo(() => {
    const term = normalize(searchTerm.trim());
    if (!term) return people;
    return people.filter((person) => normalize(`${person.firstName} ${person.lastName}`).includes(term));
  }, [people, searchTerm]);

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
        className="nx-pop rounded-b-none sm:rounded-b-xl3 w-full max-w-sm max-h-[70vh] overflow-hidden flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-display font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {people.length > 0 && (
          <div className="px-4 pt-3">
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl2 px-3 py-2 border border-slate-100 focus-within:ring-2 focus-within:ring-brand-500/10 focus-within:border-brand-300">
              <Search size={15} className="text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t("Rechercher une personne")}
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
          </div>
        )}

        <div className="overflow-y-auto p-3 space-y-1">
          {people.length === 0 && <p className="text-sm text-slate-400 text-center py-8">{emptyLabel}</p>}
          {people.length > 0 && filteredPeople.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">{t("Aucune personne ne correspond a votre recherche.")}</p>
          )}
          {filteredPeople.map((person) => (
            <Link
              key={person.id}
              href={`/profile/${person.id}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl2 hover:bg-slate-50 transition-colors"
            >
              <Avatar src={person.avatar} firstName={person.firstName} lastName={person.lastName} size="md" />
              <span className="text-sm font-medium text-slate-800 flex-1 truncate">
                {person.firstName} {person.lastName}{person.verified && <VerifiedBadge size={14} />}
              </span>
              {renderBadge && renderBadge(person)}
            </Link>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
