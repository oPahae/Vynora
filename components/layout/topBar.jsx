import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
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
  const [scrolled, setScrolled] = useState(false);

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
      <div className="h-14 md:h-[60px] px-4 sm:px-6 flex items-center gap-3">
        <Link href="/" className="md:hidden flex items-center gap-2.5 shrink-0">
          <Logomark size={32} />
          <span className="font-display text-lg font-bold tracking-tight text-slate-900">{APP_NAME}</span>
        </Link>

        <div className="hidden md:block flex-1 max-w-xl">
          <GlobalSearchBar />
        </div>

        <div className="ms-auto flex items-center gap-1">
          <Link href="/search" className="nx-icon-btn md:hidden" title={t('Rechercher')} aria-label={t('Rechercher')}>
            <Search size={19} />
          </Link>
          <ThemeToggle />
          <StatusPicker />
          <NotificationBell className="hidden md:inline-flex" />
        </div>
      </div>
    </header>
  );
}
