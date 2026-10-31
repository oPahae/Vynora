import { useState } from 'react';
import { MapPin, X } from 'lucide-react';

import { t } from '@/lib/i18n/runtime';
export default function LocationInput({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(Boolean(value));

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="nx-chip h-9 px-3 gap-2 max-xs:w-9 max-xs:px-0 max-xs:justify-center"
        title={t("Ajouter un lieu")}
        aria-label={t("Ajouter un lieu")}
      >
        <MapPin size={14} /><span className="max-xs:hidden">{t("Ajouter un lieu")}</span></button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl2 px-2.5 py-1.5">
      <MapPin size={13} className="text-slate-400 shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value.slice(0, 150))}
        placeholder={t("Casablanca, Morocco")}
        autoFocus
        className="bg-transparent text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none w-40"
      />
      <button
        type="button"
        onClick={() => {
          onChange('');
          setIsOpen(false);
        }}
        className="text-slate-400 hover:text-ember-500"
      >
        <X size={13} />
      </button>
    </div>
  );
}
