import { useState, useEffect, useRef, useCallback, memo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, MessageCircle, Share2, FolderPlus, MoreHorizontal, Volume2, VolumeX, Play, Pause, Plus, Check,
  Flag, EyeOff, Trash2, Pencil, Link2, Sparkles, Loader2, ShieldAlert, Globe, Users, Lock
} from 'lucide-react';
import Avatar from '@/components/shared/avatar';
import Modal from '@/components/shared/modal';
import ReelComments from '@/components/reels/reelComments';
import ReportModal from '@/components/reports/reportModal';
import VerifiedBadge from '@/components/shared/verifiedBadge';
import { AdminDeleteModal } from '@/components/admin/reasonModal';
import AddToCollectionModal from '@/components/collections/addToCollectionModal';
import REACTIONS from '@/components/shared/reactionTypes';
import { useAuth } from '@/lib/authContext';
import { useConfirm } from '@/lib/confirmContext';
import { useToast } from '@/lib/toastContext';
import { formatRelativeTime } from '@/lib/dateUtils';
import { formatNumber, t, td } from '@/lib/i18n/runtime';

const HASHTAG_REGEX = /(#[\p{L}0-9_]{2,50})/gu;

function compact(value) {
  return formatNumber(value, { notation: 'compact', maximumFractionDigits: 1 });
}

function Caption({ text }) {
  return text.split(HASHTAG_REGEX).map((part, index) =>
    part.startsWith('#') ? (
      <Link key={index} href={`/hashtag/${part.slice(1).toLowerCase()}`} className="font-semibold hover:underline" onClick={(e) => e.stopPropagation()}>
        {part}
      </Link>
    ) : (
      <span key={index}>{part}</span>
    )
  );
}

function whyText(why) {
  if (!why) return null;
  switch (why.kind) {
    case 'tag': return t("Parce que vous aimez #{tag}", { tag: why.tag });
    case 'friend': return t("Publie par un ami");
    case 'author': return t("Vous aimez ses reels");
    case 'new': return t("Nouveau talent a decouvrir");
    case 'trending': return t("Tendance en ce moment");
    default: return null;
  }
}

const VISIBILITY_OPTIONS = [
  { key: 'public', icon: Globe, label: () => t("Public") },
  { key: 'friends', icon: Users, label: () => t("Amis") },
  { key: 'private', icon: Lock, label: () => t("Prive") }
];

function EditReelModal({ reel, onClose, onSaved }) {
  const [caption, setCaption] = useState(reel.caption || '');
  const [visibility, setVisibility] = useState(reel.visibility);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const response = await fetch(`/api/reels/${reel.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption, visibility })
      });
      const data = await response.json();
      if (data.success) onSaved(data.reel);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={t("Modifier le reel")} onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-4">
        <textarea
          value={caption}
          maxLength={500}
          rows={4}
          onChange={(event) => setCaption(event.target.value)}
          placeholder={t("Ajoutez une legende... #hashtags")}
          className="w-full rounded-xl2 border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:bg-surface focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10 resize-none"
        />
        <div className="grid grid-cols-3 gap-2">
          {VISIBILITY_OPTIONS.map((option) => (
            <button
              key={option.key}
              onClick={() => setVisibility(option.key)}
              className={`flex items-center justify-center gap-1.5 h-10 rounded-xl2 border text-sm font-medium ${visibility === option.key ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'}`}
            >
              <option.icon size={14} /> {option.label()}
            </button>
          ))}
        </div>
        <button onClick={save} disabled={saving} className="nx-btn-primary w-full h-11">
          {saving && <Loader2 size={16} className="animate-spin" />} {t("Enregistrer")}
        </button>
      </div>
    </Modal>
  );
}

function RailButton({ icon: Icon, label, onClick, active, color, children, title }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={onClick}
        title={title || label}
        aria-label={title || label}
        className="w-12 h-12 rounded-full bg-black/35 hover:bg-black/50 backdrop-blur-md flex items-center justify-center text-white active:scale-90 transition-all"
        style={active && color ? { color } : undefined}
      >
        {children || <Icon size={24} strokeWidth={2} fill={active ? 'currentColor' : 'none'} />}
      </button>
      {label !== undefined && label !== null && (
        <span className="text-white text-xs font-semibold tabular-nums" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>{label}</span>
      )}
    </div>
  );
}

function ReelItem({ reel, active, near, muted, autoMuted, onToggleMute, onForceMute, onUpdated, onRemoved, autoOpenComments }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const { showToast } = useToast();
  const videoRef = useRef(null);
  const barRef = useRef(null);
  const containerRef = useRef(null);
  const tapRef = useRef({ last: 0, timer: null });
  const holdTimer = useRef(null);
  const trackRef = useRef({ watched: 0, loops: 0, last: 0 });
  const heartId = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [landscape, setLandscape] = useState(false);
  const [flash, setFlash] = useState(null); // 'play' | 'pause'
  const [hearts, setHearts] = useState([]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [adminDeleteOpen, setAdminDeleteOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [friendBusy, setFriendBusy] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const isOwner = user?.id === reel.userId;
  const isAdmin = user?.role === 'admin';
  const activeReaction = REACTIONS.find((r) => r.type === reel.myReaction);
  const why = whyText(reel.why);

  // --- suivi du visionnage (signal de recommandation) ---------------------------
  const flushView = useCallback(
    (useBeacon = false) => {
      const track = trackRef.current;
      const video = videoRef.current;
      const watchedMs = Math.round(track.watched);
      if (watchedMs < 400 || isOwner) {
        trackRef.current = { watched: 0, loops: 0, last: video ? video.currentTime : 0 };
        return;
      }
      const durationMs = Math.round(((video && video.duration) || reel.durationSec || 0) * 1000);
      const payload = JSON.stringify({
        watchedMs,
        durationMs,
        loops: track.loops,
        skipped: durationMs > 0 && watchedMs / durationMs < 0.25
      });
      const url = `/api/reels/${reel.id}/view`;
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
      } else {
        fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
      }
      trackRef.current = { watched: 0, loops: 0, last: video ? video.currentTime : 0 };
    },
    [isOwner, reel.id, reel.durationSec]
  );

  useEffect(() => {
    if (!active) return undefined;
    const onHide = () => flushView(true);
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      flushView(false);
    };
  }, [active, flushView]);

  // --- lecture auto : joue seulement le reel actif ------------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    if (active) {
      const attempt = video.play();
      if (attempt && attempt.catch) {
        attempt.catch(() => {
          // Autoplay avec son bloque par le navigateur : on bascule en muet.
          if (!video.muted) {
            onForceMute();
            video.muted = true;
            video.play().catch(() => {});
          }
        });
      }
    } else {
      video.pause();
      try {
        video.currentTime = 0;
      } catch (error) {
        // metadonnees pas encore chargees
      }
      if (barRef.current) barRef.current.style.transform = 'scaleX(0)';
      setPlaying(false);
    }
  }, [active, muted, near, onForceMute]);

  useEffect(() => {
    if (active && autoOpenComments) setCommentsOpen(true);
  }, [active, autoOpenComments]);

  useEffect(() => {
    if (!active) {
      setCommentsOpen(false);
      setMenuOpen(false);
      setPaletteOpen(false);
    }
  }, [active]);

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const track = trackRef.current;
    const now = video.currentTime;
    if (now >= track.last && now - track.last < 1.5) track.watched += (now - track.last) * 1000;
    else if (now < track.last - 0.5 && track.last > video.duration * 0.8) track.loops += 1;
    track.last = now;
    if (barRef.current) barRef.current.style.transform = `scaleX(${now / video.duration})`;
  }

  function seekFromPointer(event) {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    video.currentTime = ratio * video.duration;
    trackRef.current.last = video.currentTime;
  }

  function startScrub(event) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    seekFromPointer(event);
  }

  function moveScrub(event) {
    if (event.buttons) seekFromPointer(event);
  }

  // --- interactions -----------------------------------------------------------------
  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setFlash('play');
    } else {
      video.pause();
      setFlash('pause');
    }
    setTimeout(() => setFlash(null), 650);
  }

  const react = useCallback(
    async (type) => {
      setPaletteOpen(false);
      const removing = reel.myReaction === type;
      const previous = reel;
      onUpdated({
        ...reel,
        myReaction: removing ? null : type,
        totalReactions: reel.totalReactions + (removing ? -1 : reel.myReaction ? 0 : 1)
      });
      try {
        const response = await fetch(`/api/reels/${reel.id}/react`, removing
          ? { method: 'DELETE' }
          : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type }) });
        const data = await response.json();
        if (data.success) onUpdated({ ...reel, myReaction: data.myReaction, reactionsByType: data.reactionsByType, totalReactions: data.totalReactions, commentCount: data.commentCount });
        else onUpdated(previous);
      } catch (error) {
        onUpdated(previous);
      }
    },
    [reel, onUpdated]
  );

  function pushHeart(x, y) {
    heartId.current += 1;
    const id = heartId.current;
    setHearts((prev) => [...prev, { id, x, y, rotate: Math.random() * 30 - 15 }]);
    setTimeout(() => setHearts((prev) => prev.filter((h) => h.id !== id)), 900);
  }

  function handleSurfaceClick(event) {
    // Son bloque par le navigateur : le premier appui l'active (puis la lecture continue).
    if (autoMuted && muted) {
      onToggleMute();
      return;
    }
    if (commentsOpen) {
      setCommentsOpen(false);
      return;
    }
    if (menuOpen || paletteOpen) {
      setMenuOpen(false);
      setPaletteOpen(false);
      return;
    }
    const now = Date.now();
    const rect = containerRef.current.getBoundingClientRect();
    if (now - tapRef.current.last < 280) {
      clearTimeout(tapRef.current.timer);
      tapRef.current.last = 0;
      pushHeart(event.clientX - rect.left, event.clientY - rect.top);
      if (!reel.myReaction) react('like');
      return;
    }
    tapRef.current.last = now;
    tapRef.current.timer = setTimeout(togglePlay, 260);
  }

  // Raccourcis clavier relayes par le flux (reel actif uniquement).
  useEffect(() => {
    if (!active) return undefined;
    function onKey(event) {
      const key = event.detail;
      if (key === ' ') togglePlay();
      if (key === 'l') react(reel.myReaction ? reel.myReaction : 'like');
      if (key === 'c') setCommentsOpen((prev) => !prev);
      if (key === 'Escape') setCommentsOpen(false);
    }
    window.addEventListener('reel-key', onKey);
    return () => window.removeEventListener('reel-key', onKey);
  });

  async function handleFriendRequest() {
    setFriendBusy(true);
    try {
      const response = await fetch(`/api/friends/${reel.userId}/request`, { method: 'POST' });
      const data = await response.json();
      if (data.success) onUpdated({ ...reel, relation: data.status });
    } finally {
      setFriendBusy(false);
    }
  }

  async function handleShare() {
    const url = `${window.location.origin}/reels?id=${reel.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${reel.author.firstName} ${reel.author.lastName}`, url });
        return;
      } catch (error) {
        return;
      }
    }
    await navigator.clipboard.writeText(url).catch(() => {});
    showToast({ title: t("Lien copie"), type: 'success', playSound: false });
  }

  async function handleCopyLink() {
    setMenuOpen(false);
    await navigator.clipboard.writeText(`${window.location.origin}/reels?id=${reel.id}`).catch(() => {});
    showToast({ title: t("Lien copie"), type: 'success', playSound: false });
  }

  async function handleNotInterested() {
    setMenuOpen(false);
    await fetch(`/api/reels/${reel.id}/hide`, { method: 'POST' });
    showToast({ title: t("D'accord, nous vous proposerons moins de reels comme celui-ci."), type: 'info', playSound: false });
    onRemoved(reel.id);
  }

  async function handleDelete() {
    setMenuOpen(false);
    const ok = await confirm({
      title: t("Supprimer ce reel ?"),
      message: t("Cette action est definitive et ne peut pas etre annulee."),
      confirmLabel: t("Supprimer"),
      danger: true
    });
    if (!ok) return;
    const response = await fetch(`/api/reels/${reel.id}`, { method: 'DELETE' });
    const data = await response.json();
    if (data.success) onRemoved(reel.id);
    else showToast({ title: td(data.message), type: 'error', playSound: false });
  }

  const menuItems = [
    { icon: Link2, label: t("Copier le lien"), onClick: handleCopyLink },
    ...(!isOwner ? [{ icon: EyeOff, label: t("Ce reel ne m'interesse pas"), onClick: handleNotInterested }] : []),
    ...(isOwner ? [{ icon: Pencil, label: t("Modifier"), onClick: () => { setMenuOpen(false); setEditOpen(true); } }] : []),
    ...(!isOwner ? [{ icon: Flag, label: t("Signaler"), onClick: () => { setMenuOpen(false); setReportOpen(true); } }] : []),
    ...(isOwner ? [{ icon: Trash2, label: t("Supprimer"), onClick: handleDelete, danger: true }] : []),
    ...(!isOwner && isAdmin ? [{ icon: ShieldAlert, label: t("Supprimer (admin)"), onClick: () => { setMenuOpen(false); setAdminDeleteOpen(true); }, danger: true }] : [])
  ];

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full bg-black overflow-hidden snap-start snap-always md:rounded-[28px] select-none"
      data-reel-id={reel.id}
    >
      {/* Video */}
      {near && !videoError ? (
        <video
          ref={videoRef}
          src={reel.videoUrl}
          loop
          playsInline
          preload={active ? 'auto' : 'metadata'}
          muted={muted}
          onLoadedMetadata={(event) => setLandscape(event.currentTarget.videoWidth > event.currentTarget.videoHeight)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onError={() => setVideoError(true)}
          className={`absolute inset-0 w-full h-full ${landscape ? 'object-contain' : 'object-cover'}`}
        />
      ) : (
        <div className="absolute inset-0 bg-slate-900 flex items-center justify-center text-white/50 text-sm px-8 text-center">
          {videoError ? t("Impossible de lire cette video.") : <Loader2 className="animate-spin" />}
        </div>
      )}

      {/* surface tactile (tap = pause, double tap = j'aime) */}
      <div className="absolute inset-0 z-10" onClick={handleSurfaceClick} />

      {/* degrades de lisibilite */}
      <div className="absolute inset-0 bg-black/25 pointer-events-none z-10" />

      {/* indicateur lecture / pause */}
      <AnimatePresence>
        {(flash || (!playing && active && !videoError && near)) && (
          <motion.div
            key={flash || 'paused'}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.25 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
          >
            <span className="w-20 h-20 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center text-white">
              {flash === 'play' || (!flash && !playing) ? <Play size={36} fill="currentColor" className="ms-1" /> : <Pause size={36} fill="currentColor" />}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* coeurs du double tap */}
      {hearts.map((heart) => (
        <motion.div
          key={heart.id}
          initial={{ opacity: 1, scale: 0.4, rotate: heart.rotate }}
          animate={{ opacity: 0, scale: 1.7, y: -90 }}
          transition={{ duration: 0.85, ease: 'easeOut' }}
          className="absolute z-20 pointer-events-none text-rose-500 drop-shadow-lg"
          style={{ left: heart.x - 40, top: heart.y - 40 }}
        >
          <Heart size={80} fill="currentColor" />
        </motion.div>
      ))}

      {/* invitation a activer le son (autoplay bloque par le navigateur) */}
      {autoMuted && muted && active && (
        <motion.button
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={(event) => { event.stopPropagation(); onToggleMute(); }}
          className="absolute top-16 start-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-white text-slate-900 text-xs font-semibold rounded-full px-3.5 py-2 shadow-pop"
        >
          <VolumeX size={14} /> {t("Appuyez pour activer le son")}
        </motion.button>
      )}

      {/* son */}
      <button
        onClick={(event) => { event.stopPropagation(); onToggleMute(); }}
        aria-label={muted ? t("Activer le son") : t("Couper le son")}
        className="absolute top-3 end-3 z-20 w-10 h-10 rounded-full bg-black/35 backdrop-blur-md text-white flex items-center justify-center active:scale-90 transition-transform"
      >
        {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
      </button>

      {/* rail d'actions */}
      <div className="absolute end-3 bottom-20 z-20 flex flex-col items-center gap-4" onClick={(event) => event.stopPropagation()}>
        <div
          className="relative"
          onMouseEnter={() => { clearTimeout(holdTimer.current); holdTimer.current = setTimeout(() => setPaletteOpen(true), 420); }}
          onMouseLeave={() => { clearTimeout(holdTimer.current); holdTimer.current = setTimeout(() => setPaletteOpen(false), 260); }}
        >
          <AnimatePresence>
            {paletteOpen && (
              <motion.div
                initial={{ opacity: 0, x: 12, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 8, scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 520, damping: 30 }}
                className="absolute end-full me-3 top-1/2 -translate-y-1/2 flex items-center gap-1 nx-glass rounded-full shadow-pop px-2 py-1.5"
                onMouseEnter={() => clearTimeout(holdTimer.current)}
              >
                {REACTIONS.map((reaction) => (
                  <button
                    key={reaction.type}
                    onClick={() => react(reaction.type)}
                    title={reaction.label}
                    aria-label={reaction.label}
                    className="w-10 h-10 rounded-full flex items-center justify-center hover:scale-125 active:scale-95 transition-transform"
                    style={{ color: reaction.color, backgroundColor: `${reaction.color}${reel.myReaction === reaction.type ? '33' : '14'}` }}
                  >
                    <reaction.icon size={20} strokeWidth={2.25} />
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <div
            onPointerDown={(event) => {
              if (event.pointerType !== 'mouse') {
                clearTimeout(holdTimer.current);
                holdTimer.current = setTimeout(() => { holdTimer.current = 'held'; setPaletteOpen(true); }, 380);
              }
            }}
            onPointerUp={() => { if (holdTimer.current !== 'held') clearTimeout(holdTimer.current); }}
          >
            <RailButton
              label={compact(reel.totalReactions)}
              title={activeReaction ? activeReaction.label : t("J'aime")}
              active={Boolean(reel.myReaction)}
              color={activeReaction ? activeReaction.color : '#fb7185'}
              onClick={() => {
                if (holdTimer.current === 'held') { holdTimer.current = null; return; }
                react(reel.myReaction ? reel.myReaction : 'like');
              }}
            >
              {activeReaction && reel.myReaction !== 'like' ? (
                <activeReaction.icon size={24} strokeWidth={2.2} style={{ color: activeReaction.color }} />
              ) : (
                <Heart size={25} strokeWidth={2} fill={reel.myReaction ? '#fb7185' : 'none'} color={reel.myReaction ? '#fb7185' : 'currentColor'} />
              )}
            </RailButton>
          </div>
        </div>

        <RailButton icon={MessageCircle} label={compact(reel.commentCount)} title={t("Commentaires")} onClick={() => setCommentsOpen((prev) => !prev)} />
        <RailButton icon={FolderPlus} label={t("Ranger")} title={t("Ajouter a une collection")} onClick={() => setCollectionOpen(true)} />
        <RailButton icon={Share2} label={t("Partager")} onClick={handleShare} />

        <div className="relative">
          <RailButton icon={MoreHorizontal} label={null} title={t("Plus")} onClick={() => setMenuOpen((prev) => !prev)} />
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92, x: 8 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.94 }}
                className="absolute end-full me-2 bottom-0 w-60 nx-pop !rounded-2xl p-1.5 origin-bottom-right"
              >
                {menuItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    className={`w-full flex items-center gap-2.5 px-3 h-10 rounded-xl text-sm transition-colors ${item.danger ? 'text-ember-600 hover:bg-ember-50' : 'text-slate-700 hover:bg-slate-100'}`}
                  >
                    <item.icon size={15} /> {item.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* auteur + legende */}
      <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-5 pe-[4.5rem] text-white pointer-events-none">
        {why && (
          <div className="inline-flex items-center gap-1.5 text-[11px] font-medium bg-white/15 backdrop-blur-md rounded-full px-2.5 py-1 mb-2.5">
            <Sparkles size={12} /> {why}
          </div>
        )}
        <div className="flex items-center gap-2.5 pointer-events-auto">
          <Link href={`/profile/${reel.author.id}`} className="shrink-0 ring-2 ring-white/70 rounded-full">
            <Avatar src={reel.author.avatar} firstName={reel.author.firstName} lastName={reel.author.lastName} size="sm" />
          </Link>
          <Link href={`/profile/${reel.author.id}`} className="font-semibold text-[15px] truncate hover:underline" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
            {reel.author.firstName} {reel.author.lastName}
            {reel.author.verified && <VerifiedBadge className="!text-sky-300" />}
          </Link>
          {reel.relation === 'none' && !isOwner && (
            <button
              onClick={handleFriendRequest}
              disabled={friendBusy}
              className="flex items-center gap-1 text-xs font-semibold border border-white/80 rounded-full px-2.5 py-1 hover:bg-white/15 active:scale-95 transition-all"
            >
              {friendBusy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} strokeWidth={3} />} {t("Ajouter")}
            </button>
          )}
          {reel.relation === 'requestSent' && (
            <span className="flex items-center gap-1 text-xs font-medium text-white/80"><Check size={12} /> {t("Invitation envoyee")}</span>
          )}
          <span className="text-xs text-white/70 whitespace-nowrap">· {formatRelativeTime(reel.createdAt)}</span>
        </div>

        {reel.caption && (
          <p
            onClick={() => setExpanded((prev) => !prev)}
            className={`mt-2.5 text-sm leading-snug pointer-events-auto cursor-pointer break-words whitespace-pre-wrap ${expanded ? 'max-h-40 overflow-y-auto' : 'line-clamp-2'}`}
            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.55)' }}
          >
            <Caption text={reel.caption} />
          </p>
        )}
        {reel.visibility !== 'public' && (
          <p className="mt-1.5 text-[11px] text-white/70 flex items-center gap-1">
            {reel.visibility === 'friends' ? <Users size={11} /> : <Lock size={11} />}
            {reel.visibility === 'friends' ? t("Visible par vos amis") : t("Visible par vous seul")}
          </p>
        )}
      </div>

      {/* barre de progression (cliquable / glissable) */}
      <div
        className="absolute inset-x-0 bottom-0 z-30 h-4 flex items-end cursor-pointer group touch-none"
        onPointerDown={startScrub}
        onPointerMove={moveScrub}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="w-full h-[3px] group-hover:h-[6px] bg-white/25 transition-all">
          <div ref={barRef} className="h-full w-full bg-white origin-left" style={{ transform: 'scaleX(0)' }} />
        </div>
      </div>

      <AnimatePresence>
        {commentsOpen && (
          <ReelComments
            reel={reel}
            onClose={() => setCommentsOpen(false)}
            onCountChange={(delta) => onUpdated({ ...reel, commentCount: Math.max(0, reel.commentCount + delta) })}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {adminDeleteOpen && (
          <AdminDeleteModal
            type="reel"
            id={reel.id}
            title={t("Supprimer ce reel ?")}
            onClose={() => setAdminDeleteOpen(false)}
            onDeleted={() => {
              setAdminDeleteOpen(false);
              onRemoved(reel.id);
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {reportOpen && <ReportModal targetType="reel" targetId={reel.id} onClose={() => setReportOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {collectionOpen && <AddToCollectionModal itemType="reel" itemId={reel.id} onClose={() => setCollectionOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {editOpen && <EditReelModal reel={reel} onClose={() => setEditOpen(false)} onSaved={(updated) => { onUpdated({ ...reel, ...updated }); setEditOpen(false); }} />}
      </AnimatePresence>
    </div>
  );
}

export default memo(ReelItem);
