import Link from 'next/link';
import { Heart, MessageCircle, MapPin, ImageOff } from 'lucide-react';
import { formatPrice } from '@/lib/marketMeta';

import { t } from '@/lib/i18n/runtime';
export default function ProductCard({ product }) {
  const cover = product.media[0];
  const sold = product.status === 'sold';

  return (
    <Link href={`/market/${product.id}`} className="group nx-card nx-card-interactive overflow-hidden flex flex-col">
      <div className="relative aspect-square bg-slate-100 overflow-hidden">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.url}
            alt={product.title}
            loading="lazy"
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${sold ? 'opacity-60' : ''}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <ImageOff size={32} />
          </div>
        )}
        {sold && (
          <span className="absolute top-2 start-2 rounded-full bg-slate-900/80 text-white text-xs font-semibold px-2.5 py-1">
            {t("Vendu")}
          </span>
        )}
        {product.media.length > 1 && (
          <span className="absolute bottom-2 end-2 rounded-full bg-black/55 text-white text-[11px] px-2 py-0.5">
            +{product.media.length - 1}
          </span>
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col gap-1">
        <p className="font-display font-semibold text-brand-600 text-base">{formatPrice(product.price, product.currency)}</p>
        <p className="text-sm text-slate-800 line-clamp-2">{product.title}</p>
        {product.city && (
          <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
            <MapPin size={12} className="shrink-0" /> {product.city}
          </p>
        )}
        <div className="mt-auto pt-2 flex items-center gap-3 text-xs text-slate-500">
          <span className={`inline-flex items-center gap-1 ${product.likedByMe ? 'text-red-500' : ''}`}>
            <Heart size={13} fill={product.likedByMe ? 'currentColor' : 'none'} /> {product.likeCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle size={13} /> {product.commentCount}
          </span>
        </div>
      </div>
    </Link>
  );
}
