import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { Home, Users, MessageCircle, Compass, UsersRound, Hash, Bookmark, FilePen, BarChart3, Clapperboard, FolderOpen, History, ShieldCheck, Crown, Eye, Smartphone } from 'lucide-react';
import Logomark from '@/components/shared/logomark';
import UserMenu from '@/components/layout/userMenu';
import { useUnreadMessagesCount, useFriendRequestsCount } from '@/lib/useUnreadCount';
import { APP_NAME } from '@/lib/constants';
import { useAuth } from '@/lib/authContext';

import { t } from '@/lib/i18n/runtime';

export function getNavGroups(isAdmin = false, isPremium = false) {
  const groups = [
    [
      { href: '/', label: t('Accueil'), icon: Home },
      { href: '/explore', label: t('Explorer'), icon: Compass },
      { href: '/reels', label: t('Reels'), icon: Clapperboard },
      { href: '/friends', label: t('Amis'), icon: Users, badgeKey: 'friends' },
      { href: '/groups', label: t('Groupes'), icon: UsersRound },
      { href: '/servers', label: t('Serveurs'), icon: Hash },
      { href: '/messages', label: t('Messages'), icon: MessageCircle, badgeKey: 'messages' }
    ],
    [
      { href: '/saved', label: t('Enregistres'), icon: Bookmark },
      { href: '/collections', label: t('Collections'), icon: FolderOpen },
      { href: '/activity', label: t("Journal d'activite"), icon: History },
      { href: '/devices', label: t("Appareils connectes"), icon: Smartphone },
      { href: '/visitors', label: t("Visiteurs du profil"), icon: Eye },
      ...(isPremium ? [] : [{ href: '/premium', label: t("Premium"), icon: Crown }]),
      { href: '/drafts', label: t('Mes brouillons'), icon: FilePen },
      { href: '/stats', label: t('Statistiques'), icon: BarChart3 }
    ]
  ];
  if (isAdmin) groups.push([{ href: '/admin', label: t('Administration'), icon: ShieldCheck }]);
  return groups;
}

export function isActivePath(pathname, href) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem({ item, active, badge }) {
  return (
    <Link
      href={item.href}
      title={item.label}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex items-center gap-3 h-11 rounded-full px-[7px] xl:px-2.5 text-sm font-medium transition-colors justify-center xl:justify-start ${
        active ? 'text-white' : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {/* Deux reperes qui glissent d'un item a l'autre (spring) : la ligne
          entiere s'eclaire doucement, et la pastille d'icone porte la lumiere. */}
      {active && (
        <motion.span
          layoutId="sidebar-row"
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          className="absolute inset-0 rounded-full bg-brand-500"
        />
      )}
      {!active && <span aria-hidden className="absolute inset-0 rounded-full bg-slate-900/0 group-hover:bg-slate-900/[0.05] transition-colors duration-300" />}
      <span className="relative shrink-0 w-8 h-8 flex items-center justify-center">
        <item.icon
          size={20}
          strokeWidth={active ? 2.2 : 1.8}
          className={`relative transition-[color,transform] duration-300 ease-spring-soft ${active ? 'text-white' : 'group-hover:scale-110'}`}
        />
        {badge > 0 && (
          <span className="xl:hidden absolute -top-0.5 -end-0.5 w-2.5 h-2.5 rounded-full bg-ember-500 ring-2 ring-surface animate-badge-pop" />
        )}
      </span>
      <span className={`relative hidden xl:block truncate ${active ? 'font-semibold' : ''}`}>{item.label}</span>
      {badge > 0 && <span className="relative hidden xl:inline-flex ms-auto nx-badge">{badge > 99 ? '99+' : badge}</span>}
    </Link>
  );
}

export default function Sidebar() {
  const router = useRouter();
  const { count: unreadMessages } = useUnreadMessagesCount();
  const { count: friendRequests } = useFriendRequestsCount();
  const badges = { messages: unreadMessages, friends: friendRequests };
  const { user } = useAuth();
  const groups = getNavGroups(user?.role === 'admin', Boolean(user?.isPremium));

  return (
    // Rail plat colle au bord gauche : un aplat blanc separe du contenu par un simple filet.
    <aside className="hidden md:flex fixed inset-y-0 start-0 z-40 w-[72px] xl:w-[264px] flex-col bg-surface border-e border-slate-200 px-3 xl:px-4 pt-5 pb-4">
      <Link href="/" className="group flex items-center justify-center xl:justify-start gap-3 xl:px-1.5 mb-7 shrink-0" title={APP_NAME}>
        <span className="transition-transform duration-500 ease-spring-soft group-hover:rotate-[-8deg] group-hover:scale-110">
          <Logomark size={36} />
        </span>
        <span className="hidden xl:block font-display text-[1.35rem] font-bold tracking-tight text-slate-900">{APP_NAME}</span>
      </Link>

      <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-none -mx-1 px-1" aria-label="Navigation">
        {groups.map((group, index) => (
          <div key={index} className={index > 0 ? 'mt-3 pt-3 border-t border-slate-200' : ''}>
            <div className="space-y-1">
              {group.map((item) => (
                <NavItem
                  key={item.href}
                  item={item}
                  active={isActivePath(router.pathname, item.href)}
                  badge={item.badgeKey ? badges[item.badgeKey] || 0 : 0}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="pt-3 mt-3 border-t border-slate-200 shrink-0">
        <div className="xl:hidden">
          <UserMenu compact />
        </div>
        <div className="hidden xl:block">
          <UserMenu />
        </div>
      </div>
    </aside>
  );
}
