import VerifiedBadge from '@/components/shared/verifiedBadge';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { User, Settings, LogOut, Sun, Moon, ChevronsUpDown } from 'lucide-react';
import Avatar from '@/components/shared/avatar';
import { useAuth } from '@/lib/authContext';
import { useTheme } from '@/lib/themeContext';

import { t } from '@/lib/i18n/runtime';

// Selecteur clair / sombre : un controle segmente, lisible d'un coup d'oeil.
export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const options = [
    { key: 'light', icon: Sun, label: t('Clair') },
    { key: 'dark', icon: Moon, label: t('Sombre') }
  ];
  return (
    <div className="grid grid-cols-2 gap-1 p-1 rounded-xl2 bg-slate-100" role="radiogroup" aria-label={t('Apparence')}>
      {options.map(({ key, icon: Icon, label }) => {
        const active = theme === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(key)}
            className={`flex items-center justify-center gap-1.5 h-8 rounded-[10px] text-xs font-medium transition-all ${
              active ? 'bg-surface text-slate-900 shadow-soft' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// Carte utilisateur + menu de compte (barre laterale desktop / tablette).
export default function UserMenu({ compact = false }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDown(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;
  const fullName = `${user.firstName} ${user.lastName}`;

  return (
    <div className="relative" ref={ref}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-full mb-2 start-0 w-64 nx-pop p-2 z-50"
          >
            <Link
              href={`/profile/${user.id}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 p-2.5 rounded-xl2 hover:bg-slate-50 transition-colors"
            >
              <Avatar src={user.avatar} firstName={user.firstName} lastName={user.lastName} size="md" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{fullName}{user.isPremium && <VerifiedBadge size={14} />}</p>
                <p className="text-xs text-slate-500 truncate">{t('Mon profil')}</p>
              </div>
            </Link>
            <div className="h-px bg-slate-100 my-1.5" />
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-2.5 h-10 rounded-xl2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Settings size={16} className="text-slate-400" />
              {t('Parametres')}
            </Link>
            <div className="px-1 py-1.5">
              <ThemeSwitch />
            </div>
            <div className="h-px bg-slate-100 my-1.5" />
            <button
              onClick={logout}
              className="w-full flex items-center gap-2.5 px-2.5 h-10 rounded-xl2 text-sm text-ember-600 hover:bg-ember-50 transition-colors"
            >
              <LogOut size={16} />
              {t('Deconnexion')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={fullName}
        className={`w-full flex items-center gap-3 rounded-xl2 p-2 transition-colors hover:bg-slate-100 ${
          open ? 'bg-slate-100' : ''
        } ${compact ? 'justify-center' : ''}`}
      >
        <Avatar src={user.avatar} firstName={user.firstName} lastName={user.lastName} size="sm" />
        {!compact && (
          <>
            <span className="flex-1 min-w-0 text-start">
              <span className="block text-sm font-medium text-slate-900 truncate">{fullName}{user.isPremium && <VerifiedBadge size={14} />}</span>
            </span>
            <ChevronsUpDown size={15} className="text-slate-400 shrink-0" />
          </>
        )}
      </button>
    </div>
  );
}
