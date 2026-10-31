import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Home, Users, MessageCircle, Bell, Settings, LogOut, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { useUnreadMessagesCount, useUnreadNotificationsCount, useFriendRequestsCount } from '@/lib/useUnreadCount';
import Avatar from '@/components/shared/avatar';
import { ThemeSwitch } from '@/components/layout/userMenu';
import { getNavGroups } from '@/components/layout/sidebar';

import { t } from '@/lib/i18n/runtime';

// Apparition echelonnee des blocs de la feuille : le contenu se deploie de haut en bas.
const sheetList = { hidden: {}, show: { transition: { staggerChildren: 0.04, delayChildren: 0.12 } } };
const sheetItem = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 420, damping: 32 } } };

function haptic() {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(6);
  } catch (error) {}
}

function Badge({ count }) {
  if (!count) return null;
  return (
    <span className="absolute -top-1 -end-0.5 nx-badge !min-w-[18px] !h-[18px] !px-1 !text-[10px] z-20">
      {count > 9 ? '9+' : count}
    </span>
  );
}

// Feuille "Menu" : tout ce qui n'est pas dans le dock, accessible au pouce,
// fermable par glissement vers le bas.
function MenuSheet({ open, onClose }) {
  const { user, logout } = useAuth();
  // Les destinations deja presentes dans le dock ne sont pas repetees.
  const extra = getNavGroups(user?.role === 'admin', Boolean(user?.isPremium))
    .flat()
    .filter((item) => !['/', '/friends', '/messages'].includes(item.href));

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 nx-scrim"
          />
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 36, stiffness: 380 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 500) onClose();
            }}
            className="fixed inset-x-0 bottom-0 z-50 nx-pop rounded-b-none rounded-t-[30px] pb-[max(1rem,env(safe-area-inset-bottom))] max-h-[88dvh] overflow-y-auto"
          >
            <div className="flex justify-center pt-2.5 pb-1">
              <span className="w-10 h-1.5 rounded-full bg-slate-300/80" />
            </div>

            <motion.div variants={sheetList} initial="hidden" animate="show" className="px-4 pt-2 space-y-4">
              {user && (
                <motion.div variants={sheetItem}>
                <Link
                  href={`/profile/${user.id}`}
                  onClick={onClose}
                  className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50 active:bg-slate-100 transition-colors"
                  style={{ boxShadow: 'inset 0 0 0 1px rgb(var(--hairline))' }}
                >
                  <Avatar src={user.avatar} firstName={user.firstName} lastName={user.lastName} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-semibold text-slate-900 truncate">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-sm text-slate-500">{t('Mon profil')}</p>
                  </div>
                  <ChevronRight size={18} className="text-slate-300 shrink-0" />
                </Link>
                </motion.div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                {extra.map((item) => (
                  <motion.div key={item.href} variants={sheetItem}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className="flex items-center gap-3 p-3.5 min-h-[56px] rounded-2xl bg-surface-raised active:scale-[0.97] transition-transform"
                    style={{ boxShadow: '0 0 0 1px rgb(var(--hairline)), inset 0 1px 0 rgb(var(--highlight))' }}
                  >
                    <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                      <item.icon size={18} />
                    </span>
                    <span className="text-sm font-medium text-slate-800 leading-tight line-clamp-2">{item.label}</span>
                  </Link>
                  </motion.div>
                ))}
              </div>

              <motion.div variants={sheetItem}>
                <ThemeSwitch />
              </motion.div>

              <motion.div variants={sheetItem} className="grid grid-cols-2 gap-2.5">
                <Link
                  href="/settings"
                  onClick={onClose}
                  className="flex items-center justify-center gap-2 h-12 rounded-2xl bg-slate-100 text-slate-700 text-sm font-medium active:bg-slate-200 transition-colors"
                >
                  <Settings size={17} />
                  {t('Parametres')}
                </Link>
                <button
                  onClick={logout}
                  className="flex items-center justify-center gap-2 h-12 rounded-2xl bg-ember-50 text-ember-600 text-sm font-medium active:opacity-80 transition-opacity"
                >
                  <LogOut size={17} />
                  {t('Deconnexion')}
                </button>
              </motion.div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default function MobileTabBar() {
  const router = useRouter();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const { count: unreadMessages } = useUnreadMessagesCount();
  const { count: unreadNotifications } = useUnreadNotificationsCount();
  const { count: friendRequestsCount } = useFriendRequestsCount();
  const reduce = useReducedMotion();
  const [hidden, setHidden] = useState(false);

  // Le dock se range quand on lit vers le bas et revient des qu'on remonte.
  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    function onScroll() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const delta = y - last;
        if (Math.abs(delta) > 10) {
          setHidden(delta > 0 && y > 120);
          last = y;
        }
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const close = () => setMenuOpen(false);
    router.events.on('routeChangeStart', close);
    return () => router.events.off('routeChangeStart', close);
  }, [router.events]);

  const tabs = [
    { href: '/', label: t('Accueil'), icon: Home, badge: 0 },
    { href: '/friends', label: t('Amis'), icon: Users, badge: friendRequestsCount },
    { href: '/messages', label: t('Messages'), icon: MessageCircle, badge: unreadMessages },
    { href: '/notifications', label: t('Alertes'), icon: Bell, badge: unreadNotifications }
  ];

  const isActive = (href) => (href === '/' ? router.pathname === '/' : router.pathname === href || router.pathname.startsWith(`${href}/`));
  // Le menu porte aussi le profil et les pages secondaires : il est "actif" sur celles-ci.
  const menuActive =
    menuOpen || ['/profile', '/settings', '/explore', '/groups', '/servers', '/saved', '/drafts', '/stats'].some((p) => isActive(p));

  return (
    <>
      <MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} />
      <motion.nav
        className="fixed bottom-0 inset-x-0 z-30 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pointer-events-none"
        aria-label="Navigation"
        animate={{ y: hidden && !menuOpen && !reduce ? '130%' : 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 34 }}
      >
        <div className="pointer-events-auto mx-auto max-w-md nx-glass rounded-[30px] shadow-pop">
          <div className="grid grid-cols-5 px-1.5 py-1.5">
            {tabs.map((tab) => {
              const active = isActive(tab.href) && !menuOpen;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  onClick={haptic}
                  className="relative flex flex-col items-center justify-center gap-0.5 py-1.5 min-h-[56px] active:scale-90 transition-transform duration-200 ease-spring-soft"
                >
                  <span className="relative flex items-center justify-center w-12 h-8">
                    {active && (
                      <motion.span
                        layoutId="dock-active"
                        transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                        className="absolute inset-0 rounded-full bg-brand-500 shadow-glow"
                      />
                    )}
                    <tab.icon
                      size={21}
                      strokeWidth={active ? 2.3 : 1.9}
                      className={`relative z-10 transition-colors ${active ? 'text-white' : 'text-slate-500'}`}
                    />
                    <Badge count={tab.badge} />
                  </span>
                  <span className={`text-[11px] font-medium leading-none ${active ? 'text-brand-600' : 'text-slate-500'}`}>
                    {tab.label}
                  </span>
                </Link>
              );
            })}

            <button
              type="button"
              onClick={() => {
                haptic();
                setMenuOpen((prev) => !prev);
              }}
              aria-expanded={menuOpen}
              className="relative flex flex-col items-center justify-center gap-0.5 py-1.5 min-h-[56px] active:scale-90 transition-transform duration-200 ease-spring-soft"
            >
              <span className="relative flex items-center justify-center w-12 h-8">
                {menuActive && (
                  <motion.span
                    layoutId="dock-active"
                    transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                    className="absolute inset-0 rounded-full bg-brand-500 shadow-glow"
                  />
                )}
                <span className={`relative z-10 block rounded-full ${menuActive ? 'ring-2 ring-white/90 shadow-glow' : 'ring-1 ring-slate-200'}`}>
                  <Avatar src={user?.avatar} firstName={user?.firstName} lastName={user?.lastName} size="xs" />
                </span>
              </span>
              <span className={`text-[11px] font-medium leading-none ${menuActive ? 'text-brand-600' : 'text-slate-500'}`}>
                {t('Menu')}
              </span>
            </button>
          </div>
        </div>
      </motion.nav>
    </>
  );
}
