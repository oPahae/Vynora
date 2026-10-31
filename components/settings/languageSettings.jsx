import { Check, Languages } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { t } from '@/lib/i18n/runtime';

export default function LanguageSettings() {
  const { locale, setLocale, locales } = useI18n();

  return (
    <div>
      <h3 className="font-display font-semibold text-slate-900 tracking-tight mb-1 flex items-center gap-2">
        <Languages size={18} className="text-brand-500" />
        {t('Langue')}
      </h3>
      <p className="text-sm text-slate-500 mb-3">
        {t("Choisissez la langue de l'application. Le changement s'applique immediatement a toute l'interface.")}
      </p>
      <div role="radiogroup" aria-label={t('Langue')} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {locales.map((item) => {
          const active = item.code === locale;
          return (
            <button
              key={item.code}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setLocale(item.code)}
              lang={item.htmlLang}
              dir={item.dir}
              className={`flex items-center justify-between gap-3 rounded-xl2 border-2 px-4 py-3 text-start transition-all ${
                active ? 'border-brand-500 bg-brand-50 shadow-glow' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="min-w-0">
                <span className={`block text-sm font-semibold ${active ? 'text-brand-600' : 'text-slate-800'}`}>
                  {item.name}
                </span>
                <span className="block text-xs text-slate-400" dir="ltr">
                  {item.englishName}
                </span>
              </span>
              {active && <Check size={18} className="shrink-0 text-brand-600" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
