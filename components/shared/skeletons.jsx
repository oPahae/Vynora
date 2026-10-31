// Squelettes de chargement : ils reprennent la silhouette exacte du contenu
// attendu pour eviter tout saut de mise en page a l'arrivee des donnees.
export function PostSkeleton() {
  return (
    <div className="nx-card p-5 sm:p-6" aria-hidden>
      <div className="flex items-center gap-3">
        <div className="nx-skeleton w-10 h-10 rounded-full" />
        <div className="space-y-2 flex-1">
          <div className="nx-skeleton h-3 w-32" />
          <div className="nx-skeleton h-2.5 w-20" />
        </div>
      </div>
      <div className="mt-4 space-y-2.5">
        <div className="nx-skeleton h-3 w-full" />
        <div className="nx-skeleton h-3 w-[86%]" />
        <div className="nx-skeleton h-3 w-[58%]" />
      </div>
      <div className="nx-skeleton h-44 w-full mt-4 rounded-xl2" />
      <div className="flex gap-2 mt-4">
        <div className="nx-skeleton h-9 flex-1" />
        <div className="nx-skeleton h-9 flex-1" />
        <div className="nx-skeleton h-9 flex-1" />
      </div>
    </div>
  );
}

export function PostListSkeleton({ count = 2 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <PostSkeleton key={index} />
      ))}
    </div>
  );
}

export function RowSkeleton({ count = 4 }) {
  return (
    <div className="space-y-1" aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 p-3">
          <div className="nx-skeleton w-11 h-11 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="nx-skeleton h-3 w-2/5" />
            <div className="nx-skeleton h-2.5 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
