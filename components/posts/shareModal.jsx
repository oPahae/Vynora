import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, Share2, Link2, Check, Mail, Send, MessageCircle, ExternalLink } from 'lucide-react';
import EmbeddedPostCard from '@/components/posts/embeddedPostCard';
import VisibilityPicker from '@/components/posts/visibilityPicker';

import { t } from '@/lib/i18n/runtime';
// Partage hors de l'application : lien public (page /post/<id>) + raccourcis
// vers les messageries et reseaux sociaux, ou feuille de partage native du
// telephone quand elle existe.
function ExternalShare({ post }) {
  const [copied, setCopied] = useState(false);
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const url = typeof window !== 'undefined' ? `${window.location.origin}/post/${post.id}` : `/post/${post.id}`;
  const author = `${post.author?.firstName || ''} ${post.author?.lastName || ''}`.trim();
  const rawText = (post.content || '').replace(/\s+/g, ' ').trim();
  const text = rawText ? (rawText.length > 120 ? `${rawText.slice(0, 117)}...` : rawText) : t("Publication de {author}", { author });
  const isPublic = post.visibility === 'public' && !post.groupId;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
    } catch (error) {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: author, text, url });
    } catch (error) {
      // partage annule par l'utilisateur
    }
  }

  const enc = encodeURIComponent;
  const targets = [
    { key: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${enc(`${text} ${url}`)}`, icon: MessageCircle, color: '#25D366' },
    { key: 'telegram', label: 'Telegram', href: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`, icon: Send, color: '#229ED9' },
    { key: 'facebook', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`, icon: ExternalLink, color: '#1877F2' },
    { key: 'x', label: 'X', href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(text)}`, icon: ExternalLink, color: '#0f172a' },
    { key: 'email', label: t("E-mail"), href: `mailto:?subject=${enc(author)}&body=${enc(`${text}\n${url}`)}`, icon: Mail, color: '#64748b' }
  ];

  return (
    <div className="p-6 space-y-4">
      {!isPublic && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl2 px-4 py-3">
          {t("Cette publication n'est pas publique : le lien ne fonctionnera que pour les personnes autorisees a la voir. Passez-la en \"Public\" pour qu'il marche pour tout le monde.")}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-xl2 bg-slate-50 px-3 py-2">
        <Link2 size={16} className="text-slate-400 shrink-0" />
        <input readOnly value={url} onFocus={(event) => event.target.select()} className="flex-1 min-w-0 bg-transparent text-sm text-slate-700 outline-none" />
        <button type="button" onClick={copyLink} className="nx-btn-primary px-3 h-8 text-xs shrink-0">
          {copied ? <Check size={14} /> : <Link2 size={14} />} {copied ? t("Lien copie") : t("Copier le lien")}
        </button>
      </div>

      {canNativeShare && (
        <button type="button" onClick={nativeShare} className="nx-btn-ghost w-full h-11 border border-slate-200">
          <Share2 size={16} /> {t("Partager via...")}
        </button>
      )}

      <div className="grid grid-cols-5 gap-2">
        {targets.map((target) => (
          <a
            key={target.key}
            href={target.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1.5 rounded-xl2 py-3 hover:bg-slate-50 transition-colors"
          >
            <span className="w-11 h-11 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: target.color }}>
              <target.icon size={20} />
            </span>
            <span className="text-[11px] text-slate-600 truncate max-w-full">{target.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export default function ShareModal({ post, onClose, onShared }) {
  const [tab, setTab] = useState('internal');
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/posts/${post.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), visibility, visibilityUserIds: selectedUserIds })
      });
      const data = await response.json();

      if (!data.success) {
        setError(data.message || t("Erreur lors du partage"));
        return;
      }

      onShared(data.post);
    } catch (err) {
      setError(t("Impossible de contacter le serveur"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 nx-scrim flex items-end sm:items-center justify-center p-0 sm:p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        className="nx-pop rounded-b-none sm:rounded-b-xl3 w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-surface">
          <h3 className="font-display text-lg font-semibold text-slate-900">{t("Partager la publication")}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-1 px-6 pt-4">
          {[
            { key: 'internal', label: t("Sur mon profil") },
            { key: 'external', label: t("A l'exterieur") }
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`flex-1 h-9 rounded-full text-sm font-medium transition-colors ${
                tab === item.key ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'external' && <ExternalShare post={post} />}

        <form onSubmit={handleSubmit} className={`p-6 space-y-4 ${tab === 'external' ? 'hidden' : ''}`}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl2 px-4 py-3">{error}</div>
          )}

          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={t("Ajoutez un commentaire (optionnel)...")}
            rows={3}
            className="w-full resize-none bg-slate-50 rounded-xl2 px-4 py-3 text-sm outline-none transition-all focus:bg-surface focus:ring-4 focus:ring-brand-500/10 placeholder:text-slate-400"
          />

          <EmbeddedPostCard post={post} />

          <VisibilityPicker
            value={visibility}
            onChange={setVisibility}
            selectedUserIds={selectedUserIds}
            onSelectedUserIdsChange={setSelectedUserIds}
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="nx-btn-primary w-full h-11"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}{t("Partager maintenant")}</button>
        </form>
      </motion.div>
    </motion.div>
  );
}
