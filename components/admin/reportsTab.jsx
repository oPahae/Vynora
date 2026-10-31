import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AnimatePresence } from 'framer-motion';
import { Ban, CheckCheck, ChevronDown, ExternalLink, Flag, Loader2, Trash2 } from 'lucide-react';
import { PersonCell, LoadMore, Spinner } from '@/components/admin/adminCommon';
import ReasonModal from '@/components/admin/reasonModal';
import Segmented from '@/components/shared/segmented';
import EmptyState from '@/components/shared/emptyState';
import Avatar from '@/components/shared/avatar';
import { useConfirm } from '@/lib/confirmContext';
import { useSocket } from '@/lib/socketContext';
import { useToast } from '@/lib/toastContext';
import { formatRelativeTime } from '@/lib/dateUtils';
import { t, td } from '@/lib/i18n/runtime';

const REASON_LABELS = {
  spam: () => t("Spam"),
  harassment: () => t("Harcelement"),
  hate: () => t("Haine"),
  violence: () => t("Violence"),
  nudity: () => t("Nudite"),
  misinformation: () => t("Desinformation"),
  scam: () => t("Arnaque"),
  impersonation: () => t("Usurpation"),
  other: () => t("Autre")
};

const TARGET_LABELS = {
  user: () => t("Compte"),
  post: () => t("Publication"),
  comment: () => t("Commentaire"),
  reel: () => t("Reel"),
  reelComment: () => t("Commentaire de reel"),
  group: () => t("Groupe")
};

const ACTION_LABELS = {
  dismissed: () => t("Ignore"),
  content_deleted: () => t("Contenu supprime"),
  user_banned: () => t("Compte banni"),
  'content_deleted+user_banned': () => t("Contenu supprime + compte banni")
};

function ResolveBanModal({ group, onClose, onDone }) {
  const [alsoDelete, setAlsoDelete] = useState(group.targetType !== 'user' && group.exists);
  const [purge, setPurge] = useState(false);

  async function confirm(reason) {
    const response = await fetch('/api/admin/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetType: group.targetType, targetId: group.targetId, action: alsoDelete ? 'delete_and_ban' : 'ban_user', reason, purge })
    });
    const data = await response.json();
    if (data.success) onDone();
    return data;
  }

  return (
    <ReasonModal
      title={t("Bannir le compte concerne")}
      description={t("Le compte sera deconnecte immediatement ; a sa prochaine connexion, le motif ci-dessous lui sera affiche.")}
      confirmLabel={t("Bannir")}
      onConfirm={confirm}
      onClose={onClose}
    >
      {() => (
        <div className="space-y-3">
          {group.owner && <PersonCell person={group.owner} />}
          {group.targetType !== 'user' && group.exists && (
            <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={alsoDelete} onChange={(event) => setAlsoDelete(event.target.checked)} className="accent-[rgb(var(--spot))]" />
              {t("Supprimer aussi le contenu signale")}
            </label>
          )}
          <label className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={purge} onChange={(event) => setPurge(event.target.checked)} className="mt-0.5 accent-[rgb(var(--spot))]" />
            <span>{t("Supprimer tout le contenu du compte")}<span className="block text-xs text-slate-400">{t("Irreversible, meme en cas de debannissement.")}</span></span>
          </label>
        </div>
      )}
    </ReasonModal>
  );
}

function ResolveDeleteModal({ group, onClose, onDone }) {
  async function confirm(reason) {
    const response = await fetch('/api/admin/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetType: group.targetType, targetId: group.targetId, action: 'delete_content', reason })
    });
    const data = await response.json();
    if (data.success) onDone();
    return data;
  }

  return (
    <ReasonModal
      title={t("Supprimer ce contenu ?")}
      description={t("L'auteur sera notifie avec ce motif et tous les signalements de ce contenu seront clotures.")}
      confirmLabel={t("Supprimer")}
      onConfirm={confirm}
      onClose={onClose}
    />
  );
}

function ReportCard({ group, status, onResolved }) {
  const confirm = useConfirm();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(null);
  const [busy, setBusy] = useState(false);
  const [banOpen, setBanOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function toggle() {
    setOpen((prev) => !prev);
    if (!details) {
      const response = await fetch(`/api/admin/reports?targetType=${group.targetType}&targetId=${group.targetId}`);
      const data = await response.json();
      setDetails(data.success ? data.reports : []);
    }
  }

  async function resolve(action, confirmOptions) {
    if (confirmOptions) {
      const ok = await confirm({ ...confirmOptions, danger: action !== 'dismiss' });
      if (!ok) return;
    }
    setBusy(true);
    const response = await fetch('/api/admin/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetType: group.targetType, targetId: group.targetId, action })
    });
    const data = await response.json();
    setBusy(false);
    if (data.success) {
      showToast({ title: t("Signalement traite"), type: 'success', playSound: false });
      onResolved();
    } else {
      showToast({ title: td(data.message), type: 'error', playSound: false });
    }
  }

  const canDelete = group.targetType !== 'user' && group.exists;
  const canBan = group.owner && !group.owner.banned;

  return (
    <div className="nx-card !p-0 overflow-hidden">
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-600 rounded-md px-2 py-1">{TARGET_LABELS[group.targetType]()}</span>
            <span className="text-[11px] font-semibold bg-ember-50 text-ember-600 rounded-md px-2 py-1 flex items-center gap-1"><Flag size={11} /> {t("{count} signalement(s)", { count: group.reportCount })}</span>
            {!group.exists && <span className="text-[11px] font-medium bg-slate-100 text-slate-500 rounded-md px-2 py-1">{t("Contenu supprime")}</span>}
          </div>
          <span className="text-xs text-slate-400 whitespace-nowrap">{formatRelativeTime(group.lastAt)}</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {Object.entries(group.reasons).map(([reason, count]) => (
            <span key={reason} className="text-xs bg-brand-50 text-brand-700 rounded-full px-2.5 py-1">{REASON_LABELS[reason]()} × {count}</span>
          ))}
        </div>

        {group.snapshot && (
          <blockquote className="text-sm text-slate-600 bg-slate-50 rounded-xl2 px-3.5 py-2.5 border-s-4 border-slate-200 break-words line-clamp-4">{group.snapshot}</blockquote>
        )}

        <div className="flex items-center justify-between gap-3">
          {group.owner ? <PersonCell person={group.owner} subtitle={t("Auteur")} /> : <span />}
          <div className="flex items-center gap-1">
            {group.href && group.exists && (
              <Link href={group.href} target="_blank" className="nx-icon-btn w-9 h-9 text-slate-400" title={t("Ouvrir")}><ExternalLink size={16} /></Link>
            )}
            <button onClick={toggle} className="nx-icon-btn w-9 h-9 text-slate-400" title={t("Details")}><ChevronDown size={17} className={`transition-transform ${open ? 'rotate-180' : ''}`} /></button>
          </div>
        </div>

        {open && (
          <div className="border-t border-slate-100 pt-3 space-y-2.5">
            {!details ? <Loader2 size={16} className="animate-spin text-brand-400" /> : details.map((report) => (
              <div key={report.id} className="flex items-start gap-2.5 text-sm">
                <Avatar src={report.reporter.avatar} firstName={report.reporter.firstName} lastName={report.reporter.lastName} size="xs" />
                <div className="min-w-0">
                  <p className="text-slate-700"><span className="font-medium">{report.reporter.firstName} {report.reporter.lastName}</span> · {REASON_LABELS[report.reason]()} <span className="text-xs text-slate-400">· {formatRelativeTime(report.createdAt)}</span></p>
                  {report.details && <p className="text-slate-500 text-xs mt-0.5 break-words">{report.details}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {status === 'pending' ? (
        <div className="flex flex-wrap gap-2 p-3 bg-slate-50/70 border-t border-slate-100">
          <button disabled={busy} onClick={() => resolve('dismiss')} className="nx-btn-secondary !h-9 !px-3 !text-xs"><CheckCheck size={14} /> {t("Ignorer")}</button>
          {canDelete && (
            <button disabled={busy} onClick={() => setDeleteOpen(true)} className="nx-btn-secondary !h-9 !px-3 !text-xs !text-red-600">
              <Trash2 size={14} /> {t("Supprimer le contenu")}
            </button>
          )}
          {canBan && (
            <button disabled={busy} onClick={() => setBanOpen(true)} className="nx-btn-danger !h-9 !px-3 !text-xs"><Ban size={14} /> {t("Bannir le compte")}</button>
          )}
        </div>
      ) : (
        <div className="px-4 py-2.5 bg-slate-50/70 border-t border-slate-100 text-xs text-slate-500">
          {(ACTION_LABELS[group.action] || (() => group.action))()} {group.resolvedAt && `· ${formatRelativeTime(group.resolvedAt)}`}
        </div>
      )}

      <AnimatePresence>
        {deleteOpen && <ResolveDeleteModal group={group} onClose={() => setDeleteOpen(false)} onDone={() => { setDeleteOpen(false); onResolved(); }} />}
      </AnimatePresence>
      <AnimatePresence>
        {banOpen && <ResolveBanModal group={group} onClose={() => setBanOpen(false)} onDone={() => { setBanOpen(false); onResolved(); }} />}
      </AnimatePresence>
    </div>
  );
}

export default function ReportsTab({ onChanged }) {
  const { socket } = useSocket();
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (offset = 0) => {
    const response = await fetch(`/api/admin/reports?status=${status}&offset=${offset}`);
    return response.json();
  }, [status]);

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

  // Nouveau signalement recu en temps reel
  useEffect(() => {
    if (!socket) return undefined;
    socket.on('admin:report', reload);
    return () => socket.off('admin:report', reload);
  }, [socket, reload]);

  async function loadMore() {
    setLoadingMore(true);
    const data = await load(items.length);
    if (data.success) {
      setItems((prev) => [...prev, ...data.items]);
      setHasMore(Boolean(data.hasMore));
    }
    setLoadingMore(false);
  }

  return (
    <div>
      <div className="mb-4">
        <Segmented
          value={status}
          onChange={setStatus}
          items={[{ key: 'pending', label: t("En attente") }, { key: 'resolved', label: t("Traites") }, { key: 'dismissed', label: t("Ignores") }]}
        />
      </div>
      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState icon={CheckCheck} title={status === 'pending' ? t("Aucun signalement en attente. Tout est calme !") : t("Rien a afficher.")} />
      ) : (
        <div className="space-y-4">
          {items.map((group) => (
            <ReportCard
              key={`${group.targetType}-${group.targetId}`}
              group={group}
              status={status}
              onResolved={() => {
                reload();
                if (onChanged) onChanged();
              }}
            />
          ))}
        </div>
      )}
      <LoadMore hasMore={hasMore} loading={loadingMore} onClick={loadMore} />
    </div>
  );
}
