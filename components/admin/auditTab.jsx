import { useState, useEffect } from 'react';
import { ScrollText } from 'lucide-react';
import { PersonCell, LoadMore, Spinner } from '@/components/admin/adminCommon';
import EmptyState from '@/components/shared/emptyState';
import { formatRelativeTime } from '@/lib/dateUtils';
import { t } from '@/lib/i18n/runtime';

const ACTIONS = {
  delete_content: () => t("a supprime un contenu"),
  ban_user: () => t("a banni un compte"),
  ban_user_purge: () => t("a banni un compte et supprime son contenu"),
  unban_user: () => t("a debanni un compte"),
  promote_admin: () => t("a promu un administrateur"),
  demote_admin: () => t("a retire un role administrateur"),
  delete_user: () => t("a supprime un compte"),
  report_resolved: () => t("a traite un signalement"),
  report_dismissed: () => t("a ignore un signalement"),
  appeal_approved: () => t("a accepte une demande de revision"),
  appeal_rejected: () => t("a refuse une demande de revision"),
  grant_premium: () => t("a offert Premium"),
  revoke_premium: () => t("a retire Premium"),
  update_settings: () => t("a modifie les parametres")
};

export default function AuditTab() {
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    fetch('/api/admin/audit').then((r) => r.json()).then((data) => {
      if (data.success) {
        setItems(data.items);
        setHasMore(data.hasMore);
      }
      setLoading(false);
    });
  }, []);

  async function loadMore() {
    setLoadingMore(true);
    const data = await (await fetch(`/api/admin/audit?offset=${items.length}`)).json();
    if (data.success) {
      setItems((prev) => [...prev, ...data.items]);
      setHasMore(data.hasMore);
    }
    setLoadingMore(false);
  }

  if (loading) return <Spinner />;
  if (items.length === 0) return <EmptyState icon={ScrollText} tone="neutral" title={t("Aucune action d'administration enregistree.")} />;

  return (
    <div>
      <div className="nx-card !p-0 divide-y divide-slate-100 overflow-hidden">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 p-3.5">
            <div className="min-w-0 flex-1">
              <PersonCell person={item.admin} subtitle={`${(ACTIONS[item.action] || (() => item.action))()}${item.targetType ? ` · ${item.targetType} #${item.targetId}` : ''}`} />
              {item.details && <p className="text-xs text-slate-500 mt-1.5 ms-[42px] break-words">{item.details}</p>}
            </div>
            <span className="text-xs text-slate-400 whitespace-nowrap">{formatRelativeTime(item.createdAt)}</span>
          </div>
        ))}
      </div>
      <LoadMore hasMore={hasMore} loading={loadingMore} onClick={loadMore} />
    </div>
  );
}
