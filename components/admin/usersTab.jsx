import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Ban, ShieldCheck, ShieldOff, Trash2, Undo2, Crown } from 'lucide-react';
import { SearchBox, useDebounced, PersonCell, LoadMore, Spinner } from '@/components/admin/adminCommon';
import ReasonModal from '@/components/admin/reasonModal';
import EmptyState from '@/components/shared/emptyState';
import Segmented from '@/components/shared/segmented';
import { useAuth } from '@/lib/authContext';
import { useConfirm } from '@/lib/confirmContext';
import { useToast } from '@/lib/toastContext';
import { formatDate, t, td } from '@/lib/i18n/runtime';

export function BanModal({ user, onClose, onDone }) {
  const [purge, setPurge] = useState(false);

  async function confirm(reason) {
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ban', reason, purge })
    });
    const data = await response.json();
    if (data.success) onDone();
    return data;
  }

  return (
    <ReasonModal
      title={t("Bannir {name}", { name: `${user.firstName} ${user.lastName}` })}
      description={t("Le compte sera deconnecte immediatement ; a sa prochaine connexion, le motif ci-dessous lui sera affiche.")}
      confirmLabel={t("Bannir")}
      onConfirm={confirm}
      onClose={onClose}
    >
      {() => (
        <label className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={purge} onChange={(event) => setPurge(event.target.checked)} className="mt-0.5 accent-[rgb(var(--spot))]" />
          <span>
            {t("Supprimer aussi tout son contenu (publications, commentaires, reels, stories)")}
            <span className="block text-xs text-slate-400">{t("Irreversible, meme en cas de debannissement.")}</span>
          </span>
        </label>
      )}
    </ReasonModal>
  );
}

function DeleteAccountModal({ user, onClose, onDone }) {
  async function confirm(reason) {
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', reason })
    });
    const data = await response.json();
    if (data.success) onDone();
    return data;
  }

  return (
    <ReasonModal
      title={t("Supprimer definitivement ce compte ?")}
      description={t("Toutes ses donnees seront effacees (irreversible). L'utilisateur sera deconnecte immediatement et verra ce motif s'il tente de se reconnecter.")}
      confirmLabel={t("Supprimer le compte")}
      onConfirm={confirm}
      onClose={onClose}
    />
  );
}

export default function UsersTab() {
  const { user: me } = useAuth();
  const confirm = useConfirm();
  const { showToast } = useToast();
  const [q, setQ] = useState('');
  const debounced = useDebounced(q);
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [banTarget, setBanTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async (offset = 0) => {
    const response = await fetch(`/api/admin/content/users?q=${encodeURIComponent(debounced)}&filter=${filter}&offset=${offset}&limit=20`);
    return response.json();
  }, [debounced, filter]);

  const reload = useCallback(() => {
    setLoading(true);
    load(0).then((data) => {
      setItems(data.success ? data.items : []);
      setHasMore(Boolean(data.hasMore));
      setLoading(false);
    });
  }, [load]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function loadMore() {
    setLoadingMore(true);
    const data = await load(items.length);
    if (data.success) {
      setItems((prev) => [...prev, ...data.items]);
      setHasMore(Boolean(data.hasMore));
    }
    setLoadingMore(false);
  }

  async function premiumAction(user, action) {
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, days: 30 })
    });
    const data = await response.json();
    if (data.success) {
      showToast({ title: action === 'grant_premium' ? t("Premium offert (30 jours)") : t("Premium retire"), type: 'success', playSound: false });
      reload();
    } else {
      showToast({ title: td(data.message), type: 'error', playSound: false });
    }
  }

  async function act(user, action, confirmOptions) {
    if (confirmOptions) {
      const ok = await confirm({ ...confirmOptions, danger: action !== 'promote' && action !== 'unban' });
      if (!ok) return;
    }
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    const data = await response.json();
    if (data.success) {
      showToast({ title: t("Action effectuee"), type: 'success', playSound: false });
      reload();
    } else {
      showToast({ title: td(data.message), type: 'error', playSound: false });
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <SearchBox value={q} onChange={setQ} placeholder={t("Nom, email ou identifiant")} />
        <Segmented
          value={filter}
          onChange={setFilter}
          items={[{ key: 'all', label: t("Tous") }, { key: 'banned', label: t("Bannis") }, { key: 'admin', label: t("Admins") }]}
        />
      </div>

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState tone="neutral" title={t("Aucun utilisateur")} />
      ) : (
        <div className="nx-card !p-0 divide-y divide-slate-100 overflow-hidden">
          {items.map((user) => {
            const isMe = user.id === me?.id;
            return (
              <div key={user.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <PersonCell person={{ ...user, banned: user.banned }} subtitle={user.email} />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-2">
                    <span>#{user.id}</span>
                    <span>{t("Inscrit le {date}", { date: formatDate(user.createdAt.replace(' ', 'T'), { day: 'numeric', month: 'short', year: 'numeric' }) })}</span>
                    <span>{t("{count} publication(s)", { count: user.postsCount })}</span>
                    {user.reportsAgainst > 0 && <span className="text-ember-600 font-medium">{t("{count} signalement(s)", { count: user.reportsAgainst })}</span>}
                    {user.role === 'admin' && <span className="text-brand-600 font-semibold">{t("Administrateur")}</span>}
                    {user.premium && <span className="text-amber-600 font-semibold flex items-center gap-1"><Crown size={11} /> Premium</span>}
                  </div>
                  {user.banned && user.banReason && <p className="text-xs text-red-500 mt-1.5">{t("Motif")} : {user.banReason}</p>}
                </div>
                {!isMe && (
                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    {user.banned ? (
                      <button onClick={() => act(user, 'unban')} className="nx-btn-secondary !h-9 !px-3 !text-xs"><Undo2 size={14} /> {t("Debannir")}</button>
                    ) : user.role !== 'admin' ? (
                      <button onClick={() => setBanTarget(user)} className="nx-btn-secondary !h-9 !px-3 !text-xs !text-red-600"><Ban size={14} /> {t("Bannir")}</button>
                    ) : null}
                    {user.role === 'admin' ? (
                      <button onClick={() => act(user, 'demote', { title: t("Retirer le role administrateur ?"), message: t("Ce compte redeviendra un utilisateur normal."), confirmLabel: t("Retirer") })} className="nx-btn-secondary !h-9 !px-3 !text-xs"><ShieldOff size={14} /> {t("Retirer admin")}</button>
                    ) : !user.banned ? (
                      <button onClick={() => act(user, 'promote', { title: t("Promouvoir administrateur ?"), message: t("Ce compte aura le controle total du systeme."), confirmLabel: t("Promouvoir") })} className="nx-btn-secondary !h-9 !px-3 !text-xs"><ShieldCheck size={14} /> {t("Promouvoir")}</button>
                    ) : null}
                    {!user.banned && (
                      user.premium ? (
                        <button onClick={() => premiumAction(user, 'revoke_premium')} className="nx-btn-secondary !h-9 !px-3 !text-xs"><Crown size={14} /> {t("Retirer Premium")}</button>
                      ) : (
                        <button onClick={() => premiumAction(user, 'grant_premium')} className="nx-btn-secondary !h-9 !px-3 !text-xs"><Crown size={14} /> {t("Offrir Premium")}</button>
                      )
                    )}
                    {user.role !== 'admin' && (
                      <button onClick={() => setDeleteTarget(user)} className="nx-icon-btn w-9 h-9 text-red-500 hover:bg-red-50" title={t("Supprimer le compte")}><Trash2 size={15} /></button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <LoadMore hasMore={hasMore} loading={loadingMore} onClick={loadMore} />

      <AnimatePresence>
        {banTarget && <BanModal user={banTarget} onClose={() => setBanTarget(null)} onDone={() => { setBanTarget(null); reload(); }} />}
      </AnimatePresence>
      <AnimatePresence>
        {deleteTarget && <DeleteAccountModal user={deleteTarget} onClose={() => setDeleteTarget(null)} onDone={() => { setDeleteTarget(null); reload(); }} />}
      </AnimatePresence>
    </div>
  );
}
