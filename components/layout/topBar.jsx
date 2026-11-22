import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Search, X } from 'lucide-react';
import Logomark from '@/components/shared/logomark';
import ThemeToggle from '@/components/shared/themeToggle';
import GlobalSearchBar from '@/components/search/globalSearchBar';
import NotificationBell from '@/components/notifications/notificationBell';
import StatusPicker from '@/components/status/statusPicker';
import { APP_NAME } from '@/lib/constants';

import { t } from '@/lib/i18n/runtime';

// Barre superieure : meme aplat que la page ; un filet fin apparait des que le
// contenu defile dessous.
export default function TopBar() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  // Mobile : l'icone de recherche deploie la vraie barre de saisie dans l'en-tete.
  const [mobileSearch, setMobileSearch] = useState(false);

  useEffect(() => {
    const close = () => setMobileSearch(false);
    router.events.on('routeChangeStart', close);
    return () => router.events.off('routeChangeStart', close);
  }, [router.events]);

  useEffect(() => {
    let frame = 0;
    function onScroll() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setScrolled(window.scrollY > 6);
      });
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header
      className={`sticky top-0 z-30 pt-safe rounded-none border-x-0 border-t-0 border-b transition-[background-color,border-color,box-shadow] duration-500 ${
        scrolled ? 'bg-canvas/95 border-slate-200 backdrop-blur' : 'border-transparent bg-canvas'
      }`}
    >
      {mobileSearch && (
        <div className="md:hidden h-14 px-3 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <GlobalSearchBar autoFocus />
          </div>
          <button type="button" onClick={() => setMobileSearch(false)} className="nx-icon-btn shrink-0" aria-label={t('Fermer')}>
            <X size={19} />
          </button>
        </div>
      )}
      <div className={`h-14 md:h-[60px] px-3 sm:px-6 flex items-center gap-2 sm:gap-3 ${mobileSearch ? 'max-md:hidden' : ''}`}>
        <Link href="/" className="md:hidden flex items-center gap-2 shrink-0 min-w-0">
          <Logomark size={32} />
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 truncate max-xs:hidden">{APP_NAME}</span>
        </Link>

        <div className="hidden md:block flex-1 max-w-xl">
          <GlobalSearchBar />
        </div>

        <div className="ms-auto flex items-center gap-0.5 sm:gap-1 shrink-0">
          <button type="button" onClick={() => setMobileSearch(true)} className="nx-icon-btn md:hidden" title={t('Rechercher')} aria-label={t('Rechercher')}>
            <Search size={19} />
          </button>
          <ThemeToggle />
          <StatusPicker />
          <NotificationBell className="hidden md:inline-flex" />
        </div>
      </div>
    </header>
  );
}
