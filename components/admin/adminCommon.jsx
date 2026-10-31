import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Loader2 } from 'lucide-react';
import Avatar from '@/components/shared/avatar';
import { t } from '@/lib/i18n/runtime';

export function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="flex items-center gap-2 nx-card !rounded-xl2 px-3.5 h-11 w-full sm:max-w-xs focus-within:ring-4 focus-within:ring-brand-500/10 focus-within:border-brand-300">
      <Search size={16} className="text-slate-400 shrink-0" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder || t("Rechercher")} className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
    </div>
  );
}

export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function PersonCell({ person, subtitle }) {
  if (!person) return null;
  return (
    <Link href={`/profile/${person.id}`} className="flex items-center gap-2.5 min-w-0 group">
      <Avatar src={person.avatar} firstName={person.firstName} lastName={person.lastName} size="sm" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-900 truncate group-hover:underline">
          {person.firstName} {person.lastName}
          {person.banned && <span className="ms-1.5 text-[10px] font-semibold uppercase text-red-600 bg-red-50 rounded px-1.5 py-0.5">{t("Banni")}</span>}
        </span>
        {subtitle && <span className="block text-xs text-slate-400 truncate">{subtitle}</span>}
      </span>
    </Link>
  );
}

export function LoadMore({ hasMore, loading, onClick }) {
  if (!hasMore) return null;
  return (
    <button onClick={onClick} disabled={loading} className="nx-btn-secondary w-full h-11 mt-4">
      {loading ? <Loader2 size={16} className="animate-spin" /> : t("Charger plus")}
    </button>
  );
}

export function Spinner() {
  return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand-400" /></div>;
}
