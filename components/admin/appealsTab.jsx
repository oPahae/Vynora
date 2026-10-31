import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Mail, Gavel, FileWarning, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { PersonCell, LoadMore, Spinner } from '@/components/admin/adminCommon';
import Segmented from '@/components/shared/segmented';
import EmptyState from '@/components/shared/emptyState';
import Modal from '@/components/shared/modal';
import { useToast } from '@/lib/toastContext';
import { formatRelativeTime } from '@/lib/dateUtils';

const SOURCE_LABELS = {
  post: () => t("Publication"),
  comment: () => t("Commentaire"),
  reel: () => t("Reel"),
  reelComment: () => t("Commentaire de reel"),
  group: () => t("Groupe"),
  user: () => t("Compte")
};

function SourceBlock({ source, title }) {
  return (
    <div className="rounded-xl2 border border-slate-200 bg-surface px-3.5 py-3">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600"><FileWarning size={13} className="text-ember-500" /> {title || (SOURCE_LABELS[source.type] || (() => source.type))()}</span>
        {source.exists && source.href ? (
          <Link href={source.href} target="_blank" className="flex items-center gap-1 text-xs text-brand-600 font-medium hover:underline"><ExternalLink size={12} /> {t("Ouvrir")}</Link>
        ) : (
          <span className="text-[11px] text-slate-400">{t("Contenu supprime")}</span>
        )}
      </div>
      {source.snapshot ? <p className="text-sm text-slate-700 break-words whitespace-pre-wrap line-clamp-4">{source.snapshot}</p> : <p className="text-sm text-slate-400">{t("[media sans texte]")}</p>}
    </div>
  );
}
import { Loader2 } from 'lucide-react';
import { t, td } from '@/lib/i18n/runtime';

// Refus : motif obligatoire, communique par email a l'utilisateur.
function RejectModal({ appeal, onClose, onDone }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!note.trim()) {
      setError(t("Precisez le motif"));
      return;
    }
    setBusy(true);
    const response = await fetch('/api/admin/appeals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: appeal.id, decision: 'reject', note })
    });
    const data = await response.json();
    setBusy(false);
    if (data.success) onDone(data);
    else setError(td(data.message));
  }

  return (
    <Modal
      title={t("Refuser la demande")}
      onClose={onClose}
      maxWidth="max-w-md"
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className="nx-btn-secondary flex-1 h-11">{t("Annuler")}</button>
          <button onClick={submit} disabled={busy} className="nx-btn-danger flex-1 h-11">{busy && <Loader2 size={16} className="animate-spin" />} {t("Refuser")}</button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-500">{t("Ce message sera envoye par email a l'utilisateur avec la decision.")}</p>
        <textarea
          autoFocus
          value={note}
          maxLength={255}
          rows={4}
          onChange={(event) => { setNote(event.target.value); setError(''); }}
          placeholder={t("Expliquez pourquoi la suspension est maintenue...")}
          className="w-full rounded-xl2 border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:bg-surface focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10 resize-none"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </Modal>
  );
}

function ApproveModal({ appeal, onClose, onDone }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const response = await fetch('/api/admin/appeals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: appeal.id, decision: 'approve', note })
    });
    const data = await response.json();
    setBusy(false);
    if (data.success) onDone(data);
  }

  return (
    <Modal
      title={t("Retablir le compte")}
      onClose={onClose}
      maxWidth="max-w-md"
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className="nx-btn-secondary flex-1 h-11">{t("Annuler")}</button>
          <button onClick={submit} disabled={busy} className="nx-btn-primary flex-1 h-11">{busy && <Loader2 size={16} className="animate-spin" />} {t("Retablir")}</button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-500">{t("Le compte sera debanni et l'utilisateur sera prevenu par email.")}</p>
        <textarea
          value={note}
          maxLength={255}
          rows={3}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t("Message pour l'utilisateur (optionnel)")}
          className="w-full rounded-xl2 border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:bg-surface focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10 resize-none"
        />
      </div>
    </Modal>
  );
}

export default function AppealsTab({ onChanged }) {
  const { showToast } = useToast();
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [approve, setApprove] = useState(null);
  const [reject, setReject] = useState(null);

  const load = useCallback(async (offset = 0) => (await fetch(`/api/admin/appeals?status=${status}&offset=${offset}`)).json(), [status]);

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

  function done(result) {
    setApprove(null);
    setReject(null);
    showToast({
      title: result.emailSent ? t("Decision enregistree, email envoye") : t("Decision enregistree (l'email n'a pas pu etre envoye)"),
      type: result.emailSent ? 'success' : 'info',
      playSound: false
    });
    reload();
    if (onChanged) onChanged();
  }

  return (
    <div>
      <div className="mb-4">
        <Segmented
          value={status}
          onChange={setStatus}
          items={[{ key: 'pending', label: t("En attente") }, { key: 'approved', label: t("Acceptees") }, { key: 'rejected', label: t("Refusees") }]}
        />
      </div>

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState icon={Mail} tone="neutral" title={status === 'pending' ? t("Aucune demande de revision en attente.") : t("Rien a afficher.")} />
      ) : (
        <div className="space-y-4">
          {items.map((appeal) => (
            <div key={appeal.id} className="nx-card !p-0 overflow-hidden">
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <PersonCell person={appeal.user} subtitle={appeal.user.email} />
                  <span className="text-xs text-slate-400 whitespace-nowrap">{formatRelativeTime(appeal.createdAt)}</span>
                </div>
                <div className="rounded-xl2 bg-red-50/60 border border-red-100 p-3.5 space-y-2.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-red-600"><Gavel size={13} /> {t("Bannissement d'origine")}</p>
                  <p className="text-sm text-slate-800">
                    <span className="text-slate-500">{t("Motif")} : </span>
                    {appeal.ban.reason || t("Non renseigne")}
                  </p>
                  <p className="text-xs text-slate-500">
                    {appeal.ban.at && <>{t("Prononce")} {formatRelativeTime(appeal.ban.at)}</>}
                    {appeal.ban.by && <> · {t("par {name}", { name: appeal.ban.by })}</>}
                  </p>
                  {appeal.ban.source ? (
                    <SourceBlock source={appeal.ban.source} title={t("Contenu a l'origine du bannissement")} />
                  ) : appeal.relatedReports.length === 0 ? (
                    <p className="text-xs text-slate-400">{t("Aucune publication ou contenu lie a ce bannissement.")}</p>
                  ) : null}
                  {!appeal.ban.source && appeal.relatedReports.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-500">{t("Signalements lies a ce compte")}</p>
                      {appeal.relatedReports.map((report) => (
                        <SourceBlock key={`${report.type}-${report.id}`} source={report} />
                      ))}
                    </div>
                  )}
                </div>
                <blockquote className="text-sm text-slate-700 bg-slate-50 rounded-xl2 px-3.5 py-3 border-s-4 border-brand-200 whitespace-pre-wrap break-words">{appeal.message}</blockquote>
                {appeal.status !== 'pending' && (
                  <p className={`text-xs font-medium ${appeal.status === 'approved' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {appeal.status === 'approved' ? t("Compte retabli") : t("Demande refusee")}
                    {appeal.adminNote && <span className="text-slate-500 font-normal"> · {appeal.adminNote}</span>}
                  </p>
                )}
              </div>
              {appeal.status === 'pending' && (
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50/70 border-t border-slate-100">
                  <button onClick={() => setApprove(appeal)} className="nx-btn-primary !h-9 !px-3 !text-xs"><CheckCircle2 size={14} /> {t("Accepter et debannir")}</button>
                  <button onClick={() => setReject(appeal)} className="nx-btn-secondary !h-9 !px-3 !text-xs !text-red-600"><XCircle size={14} /> {t("Refuser")}</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <LoadMore hasMore={hasMore} loading={loadingMore} onClick={loadMore} />

      <AnimatePresence>{approve && <ApproveModal appeal={approve} onClose={() => setApprove(null)} onDone={done} />}</AnimatePresence>
      <AnimatePresence>{reject && <RejectModal appeal={reject} onClose={() => setReject(null)} onDone={done} />}</AnimatePresence>
    </div>
  );
}
