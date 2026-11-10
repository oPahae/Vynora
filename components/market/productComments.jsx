import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Send, Trash2 } from 'lucide-react';
import Avatar from '@/components/shared/avatar';
import VerifiedBadge from '@/components/shared/verifiedBadge';
import { useAuth } from '@/lib/authContext';
import { useConfirm } from '@/lib/confirmContext';
import { formatRelativeTime } from '@/lib/dateUtils';

import { t, td } from '@/lib/i18n/runtime';
export default function ProductComments({ product, onCountChange }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [comments, setComments] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (offset = 0) => {
      setLoading(true);
      try {
        const response = await fetch(`/api/market/${product.id}/comments?offset=${offset}&limit=20`);
        const data = await response.json();
        if (data.success) {
          setComments((prev) => (offset === 0 ? data.comments : [...prev, ...data.comments]));
          setHasMore(data.hasMore);
        }
      } finally {
        setLoading(false);
      }
    },
    [product.id]
  );

  useEffect(() => {
    load(0);
  }, [load]);

  async function submit(event) {
    event.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setError('');
    try {
      const response = await fetch(`/api/market/${product.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      const data = await response.json();
      if (!data.success) {
        setError(td(data.message) || t("Une erreur est survenue"));
        return;
      }
      setComments((prev) => [data.comment, ...prev]);
      setText('');
      onCountChange(1);
    } catch (err) {
      setError(t("Impossible de contacter le serveur"));
    } finally {
      setSending(false);
    }
  }

  async function remove(comment) {
    const ok = await confirm({
      title: t("Supprimer le commentaire"),
      message: t("Cette action est definitive."),
      confirmLabel: t("Supprimer")
    });
    if (!ok) return;
    const response = await fetch(`/api/market-comments/${comment.id}`, { method: 'DELETE' });
    const data = await response.json();
    if (data.success) {
      setComments((prev) => prev.filter((c) => c.id !== comment.id));
      onCountChange(-1);
    }
  }

  return (
    <section className="nx-card p-4 sm:p-5">
      <h2 className="font-display text-lg font-semibold text-slate-900 mb-4">
        {t("Commentaires")} ({product.commentCount})
      </h2>

      <form onSubmit={submit} className="flex items-start gap-3 mb-5">
        <Avatar src={user?.avatar} firstName={user?.firstName} lastName={user?.lastName} size="sm" />
        <div className="flex-1 min-w-0">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 1000))}
            rows={2}
            placeholder={t("Posez une question au vendeur...")}
            className="w-full resize-none text-sm rounded-xl2 border border-slate-200 bg-transparent px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
        <button type="submit" disabled={!text.trim() || sending} className="nx-btn-primary h-10 w-10 !px-0 shrink-0" aria-label={t("Envoyer")}>
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>

      {comments.length === 0 && !loading && <p className="text-sm text-slate-500 text-center py-4">{t("Aucun commentaire pour le moment.")}</p>}

      <ul className="space-y-4">
        {comments.map((comment) => {
          const canDelete = user && (comment.author.id === user.id || product.sellerId === user.id || user.role === 'admin');
          return (
            <li key={comment.id} className="flex items-start gap-3">
              <Link href={`/profile/${comment.author.id}`}>
                <Avatar src={comment.author.avatar} firstName={comment.author.firstName} lastName={comment.author.lastName} size="sm" />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="rounded-2xl bg-slate-100 px-3.5 py-2">
                  <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
                    <Link href={`/profile/${comment.author.id}`} className="hover:underline">
                      {comment.author.firstName} {comment.author.lastName}
                    </Link>
                    {comment.author.verified && <VerifiedBadge size={13} />}
                    {comment.isSeller && (
                      <span className="text-[10px] uppercase tracking-wide rounded-full bg-brand-50 text-brand-600 px-1.5 py-0.5">{t("Vendeur")}</span>
                    )}
                  </p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{comment.content}</p>
                </div>
                <p className="text-xs text-slate-400 mt-1 ms-2 flex items-center gap-3">
                  {formatRelativeTime(comment.createdAt)}
                  {canDelete && (
                    <button type="button" onClick={() => remove(comment)} className="inline-flex items-center gap-1 hover:text-red-500">
                      <Trash2 size={11} /> {t("Supprimer")}
                    </button>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {loading && <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-slate-400" /></div>}
      {hasMore && !loading && (
        <button type="button" onClick={() => load(comments.length)} className="nx-btn-ghost w-full mt-3 text-sm">
          {t("Voir plus de commentaires")}
        </button>
      )}
    </section>
  );
}
