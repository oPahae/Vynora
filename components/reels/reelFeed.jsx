import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Clapperboard, Plus, ChevronUp, ChevronDown, ArrowLeft, Loader2, RotateCcw, Sparkles, Users, ListVideo, User } from 'lucide-react';
import ReelItem from '@/components/reels/reelItem';
import ReelComposer from '@/components/reels/reelComposer';
import { t } from '@/lib/i18n/runtime';

const MUTE_KEY = 'nexus:reels:muted';

function ReelSkeleton() {
  return (
    <div className="h-full w-full bg-slate-900 md:rounded-[28px] flex items-center justify-center">
      <Loader2 className="animate-spin text-white/60" size={30} />
    </div>
  );
}

export default function ReelFeed() {
  const router = useRouter();
  const { id: startId, user: userParam, collection: collectionParam, comments: commentsParam } = router.query;
  const isReady = router.isReady;

  // Modes : forYou (recommandation) | friends | user | collection
  const fixedMode = userParam ? 'user' : collectionParam ? 'collection' : null;
  const [tab, setTab] = useState('forYou');
  const mode = fixedMode || tab;

  const [reels, setReels] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState(null);
  const [muted, setMuted] = useState(true);
  const [autoMuted, setAutoMuted] = useState(false); // coupe par le navigateur (autoplay) : on invite a activer le son
  const [composerOpen, setComposerOpen] = useState(false);
  const [error, setError] = useState('');
  const scrollerRef = useRef(null);
  const loadingRef = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    // Le son est active par defaut des que l'utilisateur est arrive par un clic
    // (les navigateurs l'autorisent alors) ; il peut le couper, son choix est memorise.
    let stored = null;
    try {
      stored = localStorage.getItem(MUTE_KEY);
    } catch (e) {
      // stockage indisponible
    }
    const hasActivation = typeof navigator !== 'undefined' && navigator.userActivation ? navigator.userActivation.hasBeenActive : true;
    if (stored === '1') setMuted(true);
    else if (hasActivation) setMuted(false);
    else setAutoMuted(true);
  }, []);

  const toggleMute = useCallback(() => {
    setAutoMuted(false);
    setMuted((prev) => {
      try { localStorage.setItem(MUTE_KEY, prev ? '0' : '1'); } catch (e) { /* ignore */ }
      return !prev;
    });
  }, []);
  const forceMute = useCallback(() => {
    setMuted(true);
    setAutoMuted(true);
  }, []);

  function buildUrl(currentMode, list, before) {
    const params = new URLSearchParams({ mode: currentMode, limit: '6' });
    if (currentMode === 'forYou') params.set('exclude', list.map((r) => r.id).slice(-200).join(','));
    if (currentMode === 'user') params.set('userId', String(userParam));
    if (currentMode === 'collection') params.set('collectionId', String(collectionParam));
    if (before && (currentMode === 'friends' || currentMode === 'user')) params.set('before', String(before));
    return `/api/reels?${params.toString()}`;
  }

  // Chargement initial (et a chaque changement de mode).
  useEffect(() => {
    if (!isReady) return undefined;
    const current = ++generation.current;
    setIsLoading(true);
    setReels([]);
    setActiveIndex(0);
    setHasMore(true);
    setCursor(null);
    setError('');
    loadingRef.current = true;

    (async () => {
      try {
        let first = [];
        // Reel cible (lien partage / notification) place en tete.
        if (startId && !fixedMode) {
          const response = await fetch(`/api/reels/${startId}`);
          const data = await response.json();
          if (data.success) first = [data.reel];
        }
        const response = await fetch(buildUrl(mode, first));
        const data = await response.json();
        if (generation.current !== current) return;
        if (!data.success) {
          setError(data.message || t("Une erreur est survenue"));
          return;
        }
        let list = data.reels;
        // Dans un profil / une playlist, on demarre au reel demande.
        if (startId && fixedMode) {
          const index = list.findIndex((r) => String(r.id) === String(startId));
          if (index > 0) list = [...list.slice(index), ...list.slice(0, index)].slice(0, list.length);
        }
        setReels([...first, ...list.filter((r) => !first.some((f) => f.id === r.id))]);
        setHasMore(Boolean(data.hasMore));
        setCursor(data.nextCursor || (list.length ? list[list.length - 1].id : null));
      } catch (err) {
        if (generation.current === current) setError(t("Impossible de contacter le serveur"));
      } finally {
        if (generation.current === current) {
          setIsLoading(false);
          loadingRef.current = false;
        }
      }
    })();
    return () => {
      generation.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, mode, startId, userParam, collectionParam]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore || mode === 'collection') return;
    loadingRef.current = true;
    setIsLoadingMore(true);
    const current = generation.current;
    try {
      const response = await fetch(buildUrl(mode, reels, cursor));
      const data = await response.json();
      if (generation.current !== current) return;
      if (data.success) {
        setReels((prev) => [...prev, ...data.reels.filter((r) => !prev.some((p) => p.id === r.id))]);
        setHasMore(Boolean(data.hasMore) && data.reels.length > 0);
        if (data.nextCursor) setCursor(data.nextCursor);
        else if (data.reels.length) setCursor(data.reels[data.reels.length - 1].id);
      }
    } finally {
      loadingRef.current = false;
      setIsLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, reels, cursor, hasMore]);

  useEffect(() => {
    if (!isLoading && reels.length > 0 && activeIndex >= reels.length - 3) loadMore();
  }, [activeIndex, reels.length, isLoading, loadMore]);

  // Detection du reel visible (IntersectionObserver sur chaque slide).
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const index = Number(entry.target.dataset.index);
            if (!Number.isNaN(index)) setActiveIndex(index);
          }
        });
      },
      { root: scroller, threshold: [0.6] }
    );
    scroller.querySelectorAll('[data-index]').forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [reels.length, isLoading]);

  const goTo = useCallback((index) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const target = scroller.querySelector(`[data-index="${index}"]`);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Clavier : fleches / j k = navigation, m = son, espace = lecture, l = aimer, c = commentaires.
  useEffect(() => {
    function onKey(event) {
      const tag = (event.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || event.target.isContentEditable || event.metaKey || event.ctrlKey) return;
      if (event.key === 'ArrowDown' || event.key === 'j') {
        event.preventDefault();
        goTo(Math.min(activeIndex + 1, reels.length - 1));
      } else if (event.key === 'ArrowUp' || event.key === 'k') {
        event.preventDefault();
        goTo(Math.max(activeIndex - 1, 0));
      } else if (event.key === 'm') {
        toggleMute();
      } else if (event.key === ' ') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('reel-key', { detail: ' ' }));
      } else if (['l', 'c', 'Escape'].includes(event.key)) {
        window.dispatchEvent(new CustomEvent('reel-key', { detail: event.key }));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, reels.length, goTo, toggleMute]);

  const updateReel = useCallback((updated) => {
    setReels((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }, []);

  const removeReel = useCallback((id) => {
    setReels((prev) => prev.filter((r) => r.id !== id));
  }, []);

  function handleCreated(reel) {
    setComposerOpen(false);
    setReels((prev) => [reel, ...prev]);
    setActiveIndex(0);
    scrollerRef.current?.scrollTo({ top: 0 });
  }

  const tabs = [
    { key: 'forYou', label: t("Pour vous"), icon: Sparkles },
    { key: 'friends', label: t("Amis"), icon: Users }
  ];
  const fixedTitle = fixedMode === 'user' ? t("Reels du profil") : t("Playlist");
  const FixedIcon = fixedMode === 'user' ? User : ListVideo;

  const atEnd = !isLoading && !hasMore && reels.length > 0;

  return (
    <div className="relative mx-auto w-full md:max-w-[440px] h-[100dvh] md:h-[calc(100dvh-9rem)] md:min-h-[520px]">
      {/* barre superieure flottante */}
      <div className="absolute top-0 inset-x-0 z-40 flex items-center justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:pt-3 pointer-events-none">
        <Link
          href="/"
          onClick={(event) => {
            if (fixedMode) {
              event.preventDefault();
              router.back();
            }
          }}
          className="md:hidden pointer-events-auto w-10 h-10 rounded-full bg-black/35 backdrop-blur-md text-white flex items-center justify-center"
          aria-label={t("Retour")}
        >
          <ArrowLeft size={20} />
        </Link>

        {fixedMode ? (
          <div className="pointer-events-auto flex items-center gap-2 bg-black/35 backdrop-blur-md text-white rounded-full px-4 h-10 text-sm font-semibold mx-auto md:mx-0">
            <FixedIcon size={16} /> {fixedTitle}
          </div>
        ) : (
          <div className="pointer-events-auto flex items-center bg-black/35 backdrop-blur-md rounded-full p-1 mx-auto md:mx-0">
            {tabs.map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className="relative px-4 h-8 rounded-full text-sm font-semibold text-white/80 data-[active=true]:text-slate-900 transition-colors flex items-center gap-1.5"
                data-active={tab === item.key}
              >
                {tab === item.key && <motion.span layoutId="reel-tab" className="absolute inset-0 rounded-full bg-white" transition={{ type: 'spring', stiffness: 460, damping: 36 }} />}
                <item.icon size={14} className="relative" />
                <span className="relative">{item.label}</span>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setComposerOpen(true)}
          className="pointer-events-auto w-10 h-10 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-soft active:scale-90 transition-transform"
          aria-label={t("Nouveau reel")}
          title={t("Nouveau reel")}
        >
          <Plus size={20} strokeWidth={2.6} />
        </button>
      </div>

      {/* navigation haut/bas (bureau) */}
      <div className="hidden md:flex absolute -end-16 top-1/2 -translate-y-1/2 flex-col gap-3">
        <button onClick={() => goTo(activeIndex - 1)} disabled={activeIndex === 0} className="nx-card !rounded-full w-11 h-11 flex items-center justify-center disabled:opacity-30" aria-label={t("Precedent")}>
          <ChevronUp size={20} />
        </button>
        <button onClick={() => goTo(activeIndex + 1)} disabled={activeIndex >= reels.length - 1} className="nx-card !rounded-full w-11 h-11 flex items-center justify-center disabled:opacity-30" aria-label={t("Suivant")}>
          <ChevronDown size={20} />
        </button>
      </div>

      <div
        ref={scrollerRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory overscroll-contain scrollbar-none md:rounded-[28px] bg-black"
        style={{ scrollbarWidth: 'none' }}
      >
        {isLoading ? (
          <div className="h-full snap-start"><ReelSkeleton /></div>
        ) : error ? (
          <div className="h-full snap-start flex flex-col items-center justify-center text-white gap-3 px-8 text-center">
            <p>{error}</p>
            <button onClick={() => router.replace(router.asPath)} className="nx-btn-secondary"><RotateCcw size={16} /> {t("Reessayer")}</button>
          </div>
        ) : reels.length === 0 ? (
          <div className="h-full snap-start flex flex-col items-center justify-center text-white gap-4 px-8 text-center bg-slate-900">
            <span className="w-16 h-16 rounded-3xl bg-white/10 flex items-center justify-center"><Clapperboard size={30} /></span>
            <div>
              <p className="font-display text-xl font-semibold">{mode === 'friends' ? t("Aucun reel de vos amis") : t("Aucun reel pour le moment")}</p>
              <p className="text-sm text-white/65 mt-1.5">{mode === 'friends' ? t("Quand vos amis publieront des reels, ils apparaitront ici.") : t("Soyez le premier a publier un reel !")}</p>
            </div>
            <button onClick={() => setComposerOpen(true)} className="nx-btn-primary"><Plus size={16} /> {t("Publier un reel")}</button>
          </div>
        ) : (
          <>
            {reels.map((reel, index) => (
              <div key={reel.id} data-index={index} className="h-full w-full snap-start snap-always">
                <ReelItem
                  reel={reel}
                  active={index === activeIndex}
                  near={Math.abs(index - activeIndex) <= 1}
                  muted={muted}
                  autoMuted={autoMuted}
                  onToggleMute={toggleMute}
                  onForceMute={forceMute}
                  onUpdated={updateReel}
                  onRemoved={removeReel}
                  autoOpenComments={index === 0 && commentsParam === '1'}
                />
              </div>
            ))}
            {isLoadingMore && (
              <div className="h-full snap-start"><ReelSkeleton /></div>
            )}
            {atEnd && (
              <div data-index={reels.length} className="h-full snap-start flex flex-col items-center justify-center text-white gap-4 px-8 text-center bg-slate-900">
                <span className="w-16 h-16 rounded-3xl bg-white/10 flex items-center justify-center"><Sparkles size={28} /></span>
                <p className="font-display text-xl font-semibold">{t("Vous avez tout vu pour le moment")}</p>
                <p className="text-sm text-white/65">{t("Revenez plus tard pour de nouveaux reels.")}</p>
                <div className="flex gap-2">
                  <button onClick={() => goTo(0)} className="nx-btn-secondary"><RotateCcw size={16} /> {t("Revoir depuis le debut")}</button>
                  <button onClick={() => setComposerOpen(true)} className="nx-btn-primary"><Plus size={16} /> {t("Publier")}</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {composerOpen && <ReelComposer onClose={() => setComposerOpen(false)} onCreated={handleCreated} />}
      </AnimatePresence>
    </div>
  );
}
