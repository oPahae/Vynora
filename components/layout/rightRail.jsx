import VerifiedBadge from '@/components/shared/verifiedBadge';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import Avatar from '@/components/shared/avatar';
import FriendButton from '@/components/friends/friendButton';
import { APP_NAME } from '@/lib/constants';

import { t } from '@/lib/i18n/runtime';

// Colonne contextuelle (xl et plus) : transforme l'espace libre en decouverte.
// Reutilise l'API de suggestions existante, sans logique supplementaire.
export default function RightRail() {
  const [items, setItems] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/friends/suggestions')
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setItems(data.success ? data.items.slice(0, 4) : []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleStatusChange(userId, status) {
    setItems((prev) => prev.map((item) => (item.id === userId ? { ...item, status } : item)));
  }

  return (
    <aside className="hidden xl:block w-[17.5rem] shrink-0">
      <div className="sticky top-[84px] space-y-4">
        <section className="nx-card p-4" aria-label={t('Suggestions')}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-[0.95rem] font-semibold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                <Sparkles size={13} />
              </span>
              {t('Suggestions')}
            </h2>
            <Link href="/friends" className="text-xs font-medium text-brand-600 hover:underline">
              {t('Voir tout')}
            </Link>
          </div>

          {items === null ? (
            <div className="space-y-3" aria-hidden>
              {[0, 1, 2].map((key) => (
                <div key={key} className="flex items-center gap-3">
                  <div className="nx-skeleton w-10 h-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="nx-skeleton h-3 w-3/4" />
                    <div className="nx-skeleton h-2.5 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">{t('Aucun element a afficher pour le moment.')}</p>
          ) : (
            <ul className="space-y-3.5">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3">
                  <Link href={`/profile/${item.id}`} className="shrink-0">
                    <Avatar src={item.avatar} firstName={item.firstName} lastName={item.lastName} size="md" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/profile/${item.id}`}
                      className="block text-sm font-medium text-slate-900 truncate hover:text-brand-600 transition-colors"
                    >
                      {item.firstName} {item.lastName}{item.verified && <VerifiedBadge size={14} />}
                    </Link>
                    <p className="text-xs text-slate-500 truncate">
                      {item.mutualFriendsCount > 0
                        ? t('{mutualFriendsCount} amis en commun', { mutualFriendsCount: item.mutualFriendsCount })
                        : '\u00A0'}
                    </p>
                  </div>
                  <FriendButton userId={item.id} status={item.status} onStatusChange={handleStatusChange} size="sm" />
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="px-2 text-[11px] text-slate-400 leading-relaxed">
          © 2026 {APP_NAME} ·{' '}
          <Link href="/settings" className="hover:text-slate-600 transition-colors">
            {t('Parametres')}
          </Link>
        </p>
      </div>
    </aside>
  );
}
