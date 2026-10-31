import { useEffect, useRef, useState } from 'react';
import { Check, Globe } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { t } from '@/lib/i18n/runtime';

// Petit selecteur de langue pour les pages non connectees (connexion,
// inscription...). Dans l'application, la langue se change dans Parametres.
export default function LanguageSwitcher({ className = '' }) {
  const { locale, setLocale, locales } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = locales.find((item) => item.code === locale);

  useEffect(() => {
    function onClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('Langue')}
        className="flex items-center gap-2 rounded-xl2 border border-slate-200 bg-surface px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
      >
        <Globe size={16} />
        <span>{current?.name}</span>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute end-0 mt-2 w-44 overflow-hidden rounded-xl2 border border-slate-100 bg-surface py-1 shadow-card z-50"
        >
          {locales.map((item) => (
            <li key={item.code}>
              <button
                type="button"
                role="option"
                aria-selected={item.code === locale}
                onClick={() => {
                  setLocale(item.code);
                  setOpen(false);
                }}
                lang={item.htmlLang}
                dir={item.dir}
                className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-start text-sm text-slate-700 hover:bg-slate-50"
              >
                <span>{item.name}</span>
                {item.code === locale && <Check size={14} className="text-brand-600" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
