import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/lib/themeContext';

import { t } from '@/lib/i18n/runtime';
export default function ThemeSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <div>
      <h3 className="font-display font-semibold text-slate-900 tracking-tight mb-3">{t("Apparence")}</h3>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setTheme('light')}
          className={`flex flex-col items-center gap-2 rounded-xl2 border-2 p-5 transition-all ${
            theme === 'light' ? 'border-brand-500 bg-brand-50 shadow-glow' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <Sun size={22} className={theme === 'light' ? 'text-brand-600' : 'text-slate-400'} />
          <span className={`text-sm font-medium ${theme === 'light' ? 'text-brand-600' : 'text-slate-600'}`}>{t("Clair")}</span>
        </button>
        <button
          onClick={() => setTheme('dark')}
          className={`flex flex-col items-center gap-2 rounded-xl2 border-2 p-5 transition-all ${
            theme === 'dark' ? 'border-brand-500 bg-brand-50 shadow-glow' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <Moon size={22} className={theme === 'dark' ? 'text-brand-600' : 'text-slate-400'} />
          <span className={`text-sm font-medium ${theme === 'dark' ? 'text-brand-600' : 'text-slate-600'}`}>{t("Sombre")}</span>
        </button>
      </div>
    </div>
  );
}
