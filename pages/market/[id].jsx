import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Heart,
  MapPin,
  Eye,
  Share2,
  Link2,
  Check,
  Pencil,
  Trash2,
  BadgeCheck,
  Tag,
  LogIn,
  UserPlus
} from 'lucide-react';
import { query } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { MARKET_SELECT, hydrateProducts, marketVisibilitySql } from '@/lib/market';
import { getBaseUrl } from '@/lib/publicPost';
import AppLayout from '@/components/layout/appLayout';
import Avatar from '@/components/shared/avatar';
import Logomark from '@/components/shared/logomark';
import VerifiedBadge from '@/components/shared/verifiedBadge';
import ContactButtons from '@/components/market/contactButtons';
import ProductComments from '@/components/market/productComments';
import ProductForm from '@/components/market/productForm';
import { categoryLabel, conditionLabel, formatPrice } from '@/lib/marketMeta';
import { useAuth } from '@/lib/authContext';
import { useConfirm } from '@/lib/confirmContext';
import { APP_NAME, pageTitle } from '@/lib/constants';
import { formatRelativeTime } from '@/lib/dateUtils';

import { t } from '@/lib/i18n/runtime';
function PublicHeader({ loginHref }) {
  return (
    <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur border-b border-slate-200">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5">
          <Logomark size={30} />
          <span className="font-display text-lg font-bold tracking-tight text-slate-900">{APP_NAME}</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href={loginHref} className="nx-btn-ghost px-3 h-9 text-sm"><LogIn size={15} /> {t("Se connecter")}</Link>
          <Link href="/register" className="nx-btn-primary px-4 h-9 text-sm"><UserPlus size={15} /> {t("Creer un compte")}</Link>
        </div>
      </div>
    </header>
  );
}

export default function ProductPage({ initialProduct, isPublicView, seo }) {
  const router = useRouter();
  const { user } = useAuth();
  const confirm = useConfirm();
  const [product, setProduct] = useState(initialProduct);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [liking, setLiking] = useState(false);

  const isSeller = user && user.id === product.sellerId;
  const loginHref = `/login?next=${encodeURIComponent(`/market/${product.id}`)}`;
  const sold = product.status === 'sold';
  const current = product.media[photoIndex] || product.media[0];

  async function toggleLike() {
    if (liking) return;
    setLiking(true);
    const was = product.likedByMe;
    setProduct((p) => ({ ...p, likedByMe: !was, likeCount: p.likeCount + (was ? -1 : 1) }));
    try {
      const response = await fetch(`/api/market/${product.id}/like`, { method: was ? 'DELETE' : 'POST' });
      const data = await response.json();
      if (data.success) setProduct((p) => ({ ...p, likedByMe: data.likedByMe, likeCount: data.likeCount }));
      else setProduct((p) => ({ ...p, likedByMe: was, likeCount: p.likeCount + (was ? 1 : -1) }));
    } catch (error) {
      setProduct((p) => ({ ...p, likedByMe: was, likeCount: p.likeCount + (was ? 1 : -1) }));
    } finally {
      setLiking(false);
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}/market/${product.id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch (error) {
      // ignore
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function shareLink() {
    const url = `${window.location.origin}/market/${product.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: product.title, text: formatPrice(product.price, product.currency), url });
      } catch (error) {
        // annule
      }
    } else {
      copyLink();
    }
  }

  async function setStatus(status) {
    const response = await fetch(`/api/market/${product.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const data = await response.json();
    if (data.success) setProduct((p) => ({ ...p, status: data.product.status }));
  }

  async function remove() {
    const ok = await confirm({
      title: t("Supprimer l'annonce"),
      message: t("Cette annonce et ses commentaires seront supprimes."),
      confirmLabel: t("Supprimer")
    });
    if (!ok) return;
    const response = await fetch(`/api/market/${product.id}`, { method: 'DELETE' });
    const data = await response.json();
    if (data.success) router.push('/market');
  }

  const body = (
    <div className={isPublicView ? 'max-w-4xl mx-auto px-4 py-6' : ''}>
      {!isPublicView && (
        <Link href="/market" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4">
          <ArrowLeft size={16} /> {t("Retour au Market")}
        </Link>
      )}

      <div className="grid md:grid-cols-[1.2fr_1fr] gap-5">
        <div>
          <div className="nx-card overflow-hidden">
            <div className="relative aspect-square bg-slate-100 flex items-center justify-center">
              {current && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={current.url} alt={product.title} className={`max-w-full max-h-full object-contain ${sold ? 'opacity-60' : ''}`} />
              )}
              {sold && (
                <span className="absolute top-3 start-3 rounded-full bg-slate-900/85 text-white text-sm font-semibold px-3 py-1">{t("Vendu")}</span>
              )}
            </div>
            {product.media.length > 1 && (
              <div className="flex gap-2 p-3 overflow-x-auto">
                {product.media.map((media, index) => (
                  <button
                    key={media.id}
                    type="button"
                    onClick={() => setPhotoIndex(index)}
                    className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden ring-2 ${index === photoIndex ? 'ring-brand-500' : 'ring-transparent'}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={media.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="nx-card p-5 space-y-3">
            <div>
              <p className="font-display text-2xl font-bold text-brand-600">{formatPrice(product.price, product.currency)}</p>
              <h1 className="font-display text-xl font-semibold text-slate-900 mt-1 break-words">{product.title}</h1>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 px-2.5 py-1"><Tag size={12} /> {categoryLabel(product.category)}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 px-2.5 py-1"><BadgeCheck size={12} /> {conditionLabel(product.condition)}</span>
              {product.city && <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 px-2.5 py-1"><MapPin size={12} /> {product.city}</span>}
            </div>

            <p className="text-xs text-slate-500 flex items-center gap-3">
              <span>{formatRelativeTime(product.createdAt)}</span>
              <span className="inline-flex items-center gap-1"><Eye size={12} /> {product.viewsCount}</span>
            </p>

            {product.description && <p className="text-sm text-slate-700 whitespace-pre-wrap break-words pt-1">{product.description}</p>}

            <div className="flex items-center gap-2 pt-1">
              {user ? (
                <button
                  type="button"
                  onClick={toggleLike}
                  className={`nx-btn-ghost h-9 px-3 border border-slate-200 ${product.likedByMe ? 'text-red-500 border-red-200 bg-red-50' : ''}`}
                  aria-pressed={product.likedByMe}
                >
                  <Heart size={16} fill={product.likedByMe ? 'currentColor' : 'none'} /> {product.likeCount}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-sm text-slate-500 px-1"><Heart size={16} /> {product.likeCount}</span>
              )}
              <button type="button" onClick={shareLink} className="nx-btn-ghost h-9 px-3 border border-slate-200">
                <Share2 size={16} /> {t("Partager")}
              </button>
              <button type="button" onClick={copyLink} className="nx-btn-ghost h-9 px-3 border border-slate-200" aria-label={t("Copier le lien")} title={t("Copier le lien")}>
                {copied ? <Check size={16} className="text-emerald-500" /> : <Link2 size={16} />}
              </button>
            </div>
          </div>

          <div className="nx-card p-5 space-y-4">
            <Link href={user ? `/profile/${product.seller.id}` : loginHref} className="flex items-center gap-3">
              <Avatar src={product.seller.avatar} firstName={product.seller.firstName} lastName={product.seller.lastName} size="md" />
              <div className="min-w-0">
                <p className="font-display font-semibold text-slate-900 truncate">
                  {product.seller.firstName} {product.seller.lastName}
                  {product.seller.verified && <VerifiedBadge size={14} />}
                </p>
                <p className="text-xs text-slate-500">{t("Vendeur")}</p>
              </div>
            </Link>

            {isSeller ? (
              <div className="space-y-2">
                <button type="button" onClick={() => setStatus(sold ? 'active' : 'sold')} className="nx-btn-primary w-full h-11">
                  {sold ? t("Remettre en vente") : t("Marquer comme vendu")}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setEditing(true)} className="nx-btn-ghost h-10 border border-slate-200"><Pencil size={15} /> {t("Modifier")}</button>
                  <button type="button" onClick={remove} className="nx-btn-ghost h-10 border border-red-200 text-red-600"><Trash2 size={15} /> {t("Supprimer")}</button>
                </div>
              </div>
            ) : user ? (
              sold ? (
                <p className="text-sm text-slate-500 text-center">{t("Cet article a ete vendu.")}</p>
              ) : (
                <ContactButtons product={product} />
              )
            ) : (
              <div className="text-center space-y-2">
                <p className="text-sm text-slate-500">{t("Connectez-vous pour contacter le vendeur, aimer et commenter.")}</p>
                <Link href={loginHref} className="nx-btn-primary w-full h-11">{t("Se connecter")}</Link>
              </div>
            )}

            {!isSeller && user && (
              <p className="text-[11px] text-slate-400 leading-snug">
                {t("Soyez prudent : payez uniquement apres avoir vu l'article et evitez les virements a l'avance.")}
              </p>
            )}
          </div>
        </div>
      </div>

      {user && (
        <div className="mt-5">
          <ProductComments
            product={product}
            onCountChange={(delta) => setProduct((p) => ({ ...p, commentCount: Math.max(0, p.commentCount + delta) }))}
          />
        </div>
      )}

      <AnimatePresence>
        {editing && (
          <ProductForm
            product={product}
            onClose={() => setEditing(false)}
            onSaved={(updated) => {
              setProduct((p) => ({ ...p, ...updated }));
              setPhotoIndex(0);
              setEditing(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <>
      <Head>
        <title>{pageTitle(product.title)}</title>
        {seo && (
          <>
            <meta name="description" content={seo.description} />
            <meta property="og:type" content="product" />
            <meta property="og:site_name" content={APP_NAME} />
            <meta property="og:title" content={seo.title} />
            <meta property="og:description" content={seo.description} />
            <meta property="og:url" content={seo.url} />
            {seo.image && <meta property="og:image" content={seo.image} />}
            <meta name="twitter:card" content={seo.image ? 'summary_large_image' : 'summary'} />
            <meta name="twitter:title" content={seo.title} />
            <meta name="twitter:description" content={seo.description} />
            {seo.image && <meta name="twitter:image" content={seo.image} />}
          </>
        )}
      </Head>
      {isPublicView ? (
        <div className="min-h-screen">
          <PublicHeader loginHref={loginHref} />
          {body}
        </div>
      ) : (
        <AppLayout>{body}</AppLayout>
      )}
    </>
  );
}

export async function getServerSideProps({ req, params }) {
  const payload = await getUserFromRequest(req);
  const productId = Number(params.id);
  if (!Number.isInteger(productId)) return { notFound: true };

  const viewerId = payload ? payload.id : 0;
  const visibility = marketVisibilitySql(viewerId);
  const rows = await query(`${MARKET_SELECT} WHERE p.id = ? AND ${visibility.clause} LIMIT 1`, [productId, ...visibility.params]);
  if (rows.length === 0) return { notFound: true };

  const isSeller = payload && rows[0].sellerId === payload.id;
  if (payload && !isSeller) await query('UPDATE marketProduct SET viewsCount = viewsCount + 1 WHERE id = ?', [productId]);

  // Les coordonnees du vendeur ne sont jamais montrees aux visiteurs sans compte.
  const [product] = await hydrateProducts(rows, viewerId, { includeContact: Boolean(payload) });
  const base = getBaseUrl(req);
  const text = (product.description || '').replace(/\s+/g, ' ').trim();
  const seo = {
    title: `${product.title} - ${product.currency === 'MAD' ? `${product.price} MAD` : `${product.price} ${product.currency}`}`,
    description: text ? (text.length > 200 ? `${text.slice(0, 197)}...` : text) : `${product.seller.firstName} ${product.seller.lastName} - ${APP_NAME} Market`,
    url: `${base}/market/${productId}`,
    image: product.media[0] ? `${base}${product.media[0].url}` : null
  };

  return {
    props: {
      initialProduct: JSON.parse(JSON.stringify(product)),
      isPublicView: !payload,
      seo
    }
  };
}
