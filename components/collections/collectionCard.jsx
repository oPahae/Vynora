import Link from 'next/link';
import { Folder, ListVideo, Play } from 'lucide-react';
import { colorGradient, COLLECTION_VISIBILITY_META } from '@/components/collections/collectionMeta';
import { t } from '@/lib/i18n/runtime';

function PreviewTile({ preview }) {
  if (!preview || !preview.url) return <div className="bg-white/10" />;
  return preview.isVideo ? (
    <video src={`${preview.url}#t=0.4`} muted playsInline preload="metadata" className="w-full h-full object-cover" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={preview.url} alt="" className="w-full h-full object-cover" loading="lazy" />
  );
}

export default function CollectionCard({ collection, href }) {
  const Icon = collection.kind === 'folder' ? Folder : ListVideo;
  const visibility = COLLECTION_VISIBILITY_META[collection.visibility];
  const previews = collection.previews || [];

  return (
    <Link href={href || `/collections/${collection.id}`} className="group block nx-card nx-card-interactive !p-0 overflow-hidden">
      <div className="relative aspect-[16/10] overflow-hidden" style={{ background: colorGradient(collection.color) }}>
        {previews.length > 0 ? (
          <div className={`absolute inset-0 grid gap-px ${previews.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} ${previews.length > 2 ? 'grid-rows-2' : ''}`}>
            {previews.slice(0, 4).map((preview, index) => (
              <PreviewTile key={index} preview={preview} />
            ))}
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/70">
            <Icon size={42} strokeWidth={1.5} />
          </div>
        )}
        <div className="absolute inset-0 bg-black/25" />
        <span className="absolute top-2.5 start-2.5 w-8 h-8 rounded-xl bg-black/35 backdrop-blur-md text-white flex items-center justify-center">
          <Icon size={16} />
        </span>
        {collection.kind === 'playlist' && collection.itemCount > 0 && (
          <span className="absolute bottom-2.5 end-2.5 w-9 h-9 rounded-full bg-white text-slate-900 flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all">
            <Play size={15} fill="currentColor" className="ms-0.5" />
          </span>
        )}
      </div>
      <div className="p-3.5">
        <p className="font-semibold text-slate-900 truncate">{collection.name}</p>
        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
          <span>
            {collection.kind === 'folder'
              ? t("{count} element(s)", { count: collection.itemCount + collection.childCount })
              : t("{count} element(s)", { count: collection.itemCount })}
          </span>
          {visibility && (
            <span className="flex items-center gap-1 text-slate-400">
              · <visibility.icon size={11} /> {visibility.label()}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
