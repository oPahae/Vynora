import { useEffect, useRef } from 'react';

export default function InfiniteScrollSentinel({ onIntersect, enabled }) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!enabled || !sentinelRef.current) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onIntersect();
      },
      { rootMargin: '250px' }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [enabled, onIntersect]);

  return <div ref={sentinelRef} className="h-1 w-full" />;
}
