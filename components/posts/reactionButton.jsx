import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring, useReducedMotion } from 'framer-motion';
import REACTIONS from '@/components/shared/reactionTypes';

import { t } from '@/lib/i18n/runtime';
const ENDPOINT_PREFIX = { post: 'posts', comment: 'comments', story: 'stories', reel: 'reels', reelComment: 'reel-comments' };

const HOVER_OPEN_DELAY = 380; // survol prolonge (souris)
const HOLD_OPEN_DELAY = 360; // appui long (tactile)
const CLOSE_DELAY = 240;

// Une icone de la palette : elle grossit et se souleve selon sa distance au
// curseur (effet de lentille), avec un ressort pour que le mouvement reste doux.
function DockItem({ mouseX, reaction, isActive, onPick, reduce }) {
  const ref = useRef(null);
  const distance = useTransform(mouseX, (value) => {
    const box = ref.current ? ref.current.getBoundingClientRect() : { x: 0, width: 0 };
    return value - box.x - box.width / 2;
  });
  const scaleRaw = useTransform(distance, [-96, 0, 96], [1, 1.6, 1]);
  const scale = useSpring(scaleRaw, { stiffness: 420, damping: 26, mass: 0.4 });
  const y = useTransform(scale, [1, 1.6], [0, -12]);
  const Icon = reaction.icon;

  return (
    <motion.div ref={ref} style={reduce ? undefined : { scale, y }} className="group relative">
      <span className="pointer-events-none absolute -top-9 inset-x-0 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <span className="whitespace-nowrap rounded-full bg-ink text-white ring-1 ring-white/15 text-[11px] font-medium px-2 py-1 shadow-pop">{reaction.label}</span>
      </span>
      <button
        type="button"
        onClick={() => onPick(reaction.type)}
        aria-label={reaction.label}
        className="w-10 h-10 flex items-center justify-center rounded-full active:scale-90 transition-transform duration-150"
        style={{
          color: reaction.color,
          backgroundColor: `${reaction.color}${isActive ? '33' : '1A'}`,
          boxShadow: isActive ? `inset 0 0 0 1.5px ${reaction.color}` : undefined
        }}
      >
        <Icon size={20} strokeWidth={2.25} />
      </button>
    </motion.div>
  );
}

// Eclat de particules a la couleur de la reaction choisie.
function Burst({ color }) {
  const count = 9;
  return (
    <span aria-hidden className="pointer-events-none absolute start-[22px] top-1/2 w-0 h-0">
      {Array.from({ length: count }).map((_, index) => {
        const angle = (index / count) * Math.PI * 2;
        const reach = 22 + (index % 2) * 8;
        return (
          <motion.span
            key={index}
            className="absolute -ms-[3px] -mt-[3px] w-[6px] h-[6px] rounded-full"
            style={{ background: color }}
            initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            animate={{ x: Math.cos(angle) * reach, y: Math.sin(angle) * reach, scale: 0, opacity: 0 }}
            transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
          />
        );
      })}
    </span>
  );
}

export default function ReactionButton({ targetType, targetId, myReaction, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  // Etat optimiste : l'interface repond au doigt, le serveur confirme ensuite.
  const [localReaction, setLocalReaction] = useState(myReaction);
  const [burst, setBurst] = useState(null);
  const containerRef = useRef(null);
  const openTimer = useRef(null);
  const closeTimer = useRef(null);
  const heldOpen = useRef(false);
  const mouseX = useMotionValue(Infinity);
  const reduce = useReducedMotion();

  useEffect(() => {
    setLocalReaction(myReaction);
  }, [myReaction]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('pointerdown', handleClickOutside);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      clearTimeout(openTimer.current);
      clearTimeout(closeTimer.current);
    };
  }, []);

  const endpoint = `/api/${ENDPOINT_PREFIX[targetType]}/${targetId}/react`;

  const applyReaction = useCallback(
    async (type) => {
      setIsOpen(false);
      const previous = localReaction;
      const removing = previous === type;
      setLocalReaction(removing ? null : type);
      if (!removing && !reduce) {
        const meta = REACTIONS.find((item) => item.type === type);
        setBurst({ id: Date.now(), color: meta ? meta.color : '#3D63E8' });
        setTimeout(() => setBurst(null), 700);
      }
      try {
        const response = await fetch(endpoint, removing
          ? { method: 'DELETE' }
          : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type }) });
        const data = await response.json();
        if (data.success) onChange(removing ? null : type, data);
        else setLocalReaction(previous);
      } catch (error) {
        setLocalReaction(previous);
      }
    },
    [endpoint, localReaction, onChange, reduce]
  );

  function scheduleOpen(delay) {
    clearTimeout(closeTimer.current);
    clearTimeout(openTimer.current);
    openTimer.current = setTimeout(() => setIsOpen(true), delay);
  }
  function scheduleClose() {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setIsOpen(false), CLOSE_DELAY);
  }

  function handlePointerEnter(event) {
    if (event.pointerType === 'mouse') scheduleOpen(HOVER_OPEN_DELAY);
  }
  function handlePointerLeave(event) {
    if (event.pointerType === 'mouse') {
      scheduleClose();
      mouseX.set(Infinity);
    }
  }
  // Tactile : appui long = palette ; appui bref = j'aime / retirer.
  function handlePointerDown(event) {
    heldOpen.current = false;
    if (event.pointerType !== 'mouse') {
      clearTimeout(openTimer.current);
      openTimer.current = setTimeout(() => {
        heldOpen.current = true;
        setIsOpen(true);
      }, HOLD_OPEN_DELAY);
    }
  }
  function handlePointerUp(event) {
    if (event.pointerType !== 'mouse') clearTimeout(openTimer.current);
  }
  function handleClick() {
    // Si l'appui long vient d'ouvrir la palette, on ne declenche pas aussi un "j'aime".
    if (heldOpen.current) {
      heldOpen.current = false;
      return;
    }
    clearTimeout(openTimer.current);
    applyReaction(localReaction || 'like');
  }
  function handleKeyDown(event) {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
    }
    if (event.key === 'Escape') setIsOpen(false);
  }

  const active = REACTIONS.find((reaction) => reaction.type === localReaction);
  const ActiveIcon = active ? active.icon : REACTIONS[0].icon;

  return (
    <div
      className="relative"
      ref={containerRef}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <button
        type="button"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={handleKeyDown}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-pressed={Boolean(active)}
        className="relative flex items-center justify-center gap-1.5 text-sm font-medium h-10 px-3 rounded-xl2 hover:bg-slate-100/80 active:scale-[0.94] transition-[transform,background-color] duration-200 ease-spring-soft whitespace-nowrap select-none [-webkit-touch-callout:none]"
        style={{ color: active ? active.color : undefined }}
      >
        {active ? (
          <span
            key={active.type}
            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 animate-pop-heart"
            style={{ backgroundColor: active.color, boxShadow: `0 4px 12px -3px ${active.color}AA` }}
          >
            <ActiveIcon size={14} className="text-white" strokeWidth={2.5} />
          </span>
        ) : (
          <ActiveIcon size={18} strokeWidth={2} className="text-slate-500" />
        )}
        <span className={active ? '' : 'text-slate-500'}>{active ? active.label : t("J'aime")}</span>
        {burst && <Burst key={burst.id} color={burst.color} />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 12, scale: 0.86 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.92, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 520, damping: 30 }}
            onPointerMove={(event) => mouseX.set(event.clientX)}
            onPointerLeave={() => mouseX.set(Infinity)}
            onPointerEnter={() => clearTimeout(closeTimer.current)}
            className="absolute bottom-full start-0 mb-2.5 flex items-end gap-1 nx-glass rounded-full shadow-pop px-2.5 pt-2 pb-2 z-30 origin-bottom-left"
          >
            {REACTIONS.map((reaction) => (
              <DockItem
                key={reaction.type}
                mouseX={mouseX}
                reaction={reaction}
                isActive={localReaction === reaction.type}
                onPick={applyReaction}
                reduce={reduce}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
