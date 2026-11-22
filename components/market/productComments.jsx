import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, CornerDownRight, Loader2, Send, Trash2 } from 'lucide-react';
import Avatar from '@/components/shared/avatar';
import VerifiedBadge from '@/components/shared/verifiedBadge';
import { useAuth } from '@/lib/authContext';
import { useConfirm } from '@/lib/confirmContext';
import { formatRelativeTime } from '@/lib/dateUtils';

import { t, td } from '@/lib/i18n/runtime';

// Champ de saisie d'une reponse (ou d'un commentaire) : meme POST, avec ou sans parentId.
function ReplyBox({ productId, parentId, placeholder, onCreated, onCancel }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setError('');
    try {
      const response = await fetch(`/api/market/${productId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, parentId })
      });
      const data = await response.json();
      if (!data.success) {
        setError(td(data.message) || t("Une erreur est survenue"));
        return;
      }
      setText('');
      onCreated(data.comment);
    } catch (err) {
      setError(t("Impossible de contacter le serveur"));
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex items-start gap-2 mt-2">
      <Avatar src={user?.avatar} firstName={user?.firstName} lastName={user?.lastName} size="xs" />
      <div className="flex-1 min-w-0">
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 1000))}
          onKeyDown={(e) => e.key === 'Escape' && onCancel()}
          placeholder={placeholder}
          className="nx-field h-9 !py-0 !rounded-full text-sm"
        />
        {error && <p className="text-xs text-red-600 mt-1 ms-2">{error}</p>}
      </div>
      <button type="submit" disabled={!text.trim() || sending} className="nx-btn-primary h-9 w-9 !px-0 shrink-0" aria-label={t("Envoyer")}>
        {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
      </button>
    </form>
  );
}

function CommentRow({ comment, product, isReply = false, onReply, onRemove }) {
  const { user } = useAuth();
  const canDelete = user && (comment.author.id === user.id || product.sellerId === user.id || user.role === 'admin');

  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <Link href={`/profile/${comment.author.id}`} className="shrink-0">
        <Avatar src={comment.author.avatar} firstName={comment.author.firstName} lastName={comment.author.lastName} size={isReply ? 'xs' : 'sm'} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-slate-100 px-3.5 py-2 w-fit max-w-full">
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
        <p className="text-xs text-slate-400 mt-1 ms-2 flex items-center flex-wrap gap-x-3 gap-y-1">
          {formatRelativeTime(comment.createdAt)}
          <button type="button" onClick={onReply} className="font-medium hover:text-slate-600">
            {t("Repondre")}
          </button>
          {canDelete && (
            <button type="button" onClick={() => onRemove(comment)} className="inline-flex items-center gap-1 hover:text-red-500">
              <Trash2 size={11} /> {t("Supprimer")}
            </button>
          )}
        </p>
      </div>
    </div>
  );
}

// Un commentaire de premier niveau, avec ses reponses (chargees a la demande).
function CommentThread({ comment, product, onChanged, onRemoved, onCountChange }) {
  const confirm = useConfirm();
  const [replies, setReplies] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [replying, setReplying] = useState(false);

  async function loadReplies() {
    setLoading(true);
    try {
      const response = await fetch(`/api/market/${product.id}/comments?parentId=${comment.id}&limit=50`);
      const data = await response.json();
      setReplies(data.success ? data.comments : []);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  async function toggleReplies() {
    if (!open && !loaded) await loadReplies();
    setOpen((prev) => !prev);
  }

  function handleReplyCreated(reply) {
    setReplies((prev) => (loaded ? [...prev, reply] : prev));
    setReplying(false);
    onChanged(comment.id, { replyCount: comment.replyCount + 1 });
    onCountChange(1);
    if (!loaded) {
      // Premiere reponse : on charge la liste complete pour ne rien omettre.
      loadReplies().then(() => setOpen(true));
    } else {
      setOpen(true);
    }
  }

  async function removeReply(reply) {
    const ok = await confirm({
      title: t("Supprimer le commentaire"),
      message: t("Cette action est definitive."),
      confirmLabel: t("Supprimer")
    });
    if (!ok) return;
    const response = await fetch(`/api/market-comments/${reply.id}`, { method: 'DELETE' });
    const data = await response.json();
    if (data.success) {
      setReplies((prev) => prev.filter((item) => item.id !== reply.id));
      onChanged(comment.id, { replyCount: Math.max(0, comment.replyCount - 1) });
      onCountChange(-1);
    }
  }

  return (
    <li className="min-w-0">
      <CommentRow comment={comment} product={product} onReply={() => setReplying((prev) => !prev)} onRemove={onRemoved} />

      <div className="ms-10">
        {comment.replyCount > 0 && (
          <button
            type="button"
            onClick={toggleReplies}
            className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 mt-1.5 ms-1"
          >
            <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            {loading ? t("Chargement...") : open ? t("Masquer les reponses") : t("Voir {replyCount} reponses", { replyCount: comment.replyCount })}
          </button>
        )}

        {open && replies.length > 0 && (
          <div className="mt-2.5 ps-3 border-s-2 border-slate-100 space-y-3">
            {replies.map((reply) => (
              <CommentRow key={reply.id} comment={reply} product={product} isReply onReply={() => setReplying(true)} onRemove={removeReply} />
            ))}
          </div>
        )}

        {replying && (
          <div className="flex items-start gap-1.5 text-slate-300">
            <CornerDownRight size={14} className="mt-3.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <ReplyBox
                productId={product.id}
                parentId={comment.id}
                placeholder={t("Repondre a {firstName}...", { firstName: comment.author.firstName })}
                onCreated={handleReplyCreated}
                onCancel={() => setReplying(false)}
              />
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

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
      // Les reponses du commentaire partent avec lui.
      onCountChange(-(data.removed || 1));
    }
  }

  function patchComment(id, patch) {
    setComments((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
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
        {comments.map((comment) => (
          <CommentThread
            key={comment.id}
            comment={comment}
            product={product}
            onChanged={patchComment}
            onRemoved={remove}
            onCountChange={onCountChange}
          />
        ))}
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
