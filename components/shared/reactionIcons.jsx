import { useId } from 'react';

// Icones de reactions : pastilles rondes et brillantes (style "bulle").
// Chaque icone remplit entierement son carre `size` : on l'affiche donc telle
// quelle, sans pastille de couleur autour.
const INK = '#1C1A2E';

function Badge({ size = 24, className = '', style, children, label, defs }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`shrink-0 ${className}`}
      style={style}
      role="img"
      aria-label={label}
      focusable="false"
    >
      <defs>{defs}</defs>
      {children}
    </svg>
  );
}

// Reflet brillant en haut a gauche, commun a toutes les pastilles.
function Gloss() {
  return <ellipse cx="31" cy="23" rx="15" ry="8.5" transform="rotate(-38 31 23)" fill="#fff" opacity="0.38" />;
}

function useIds() {
  return useId().replace(/:/g, '');
}

function Face({ id, from = '#FFDD62', to = '#FDB045', children }) {
  return (
    <>
      <circle cx="50" cy="50" r="48" fill={`url(#${id}-bg)`} />
      <circle cx="50" cy="50" r="47.2" fill="none" stroke="#E8941F" strokeOpacity="0.45" strokeWidth="1.2" />
      {children}
      <Gloss />
    </>
  );
}

function faceDefs(id, from = '#FFDD62', to = '#FDB045') {
  return (
    <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.45" stopColor={from} />
      <stop offset="1" stopColor={to} />
    </linearGradient>
  );
}

export function LikeIcon(props) {
  const id = useIds();
  return (
    <Badge {...props} label="like" defs={
      <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" stopColor="#FF5C78" />
        <stop offset="1" stopColor="#E31A5C" />
      </linearGradient>
    }>
      <circle cx="50" cy="50" r="48" fill={`url(#${id}-bg)`} />
      <path d="M50 77C27 62 21 50 21 40.5 21 32 27.5 26 35.5 26c6 0 11 3.4 14.5 8.6C53.5 29.4 58.5 26 64.5 26 72.5 26 79 32 79 40.5 79 50 73 62 50 77z" fill="#fff" />
      <Gloss />
    </Badge>
  );
}

export function DislikeIcon(props) {
  const id = useIds();
  return (
    <Badge {...props} label="dislike" defs={
      <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stopColor="#B650FF" />
        <stop offset="1" stopColor="#6A1FF0" />
      </linearGradient>
    }>
      <circle cx="50" cy="50" r="48" fill={`url(#${id}-bg)`} />
      <rect x="22" y="29" width="14" height="32" rx="3.2" fill="#fff" />
      <path d="M40 30h26c4 0 6.5 2.6 6.5 5.4 0 1.6-.6 2.8-1.6 3.8 2 .6 3.6 2.6 3.6 4.8 0 1.8-1 3.2-2.4 4.1 1 .8 1.6 2 1.6 3.4 0 2.8-2.4 4.9-5.2 4.900H56c.6 3 2.2 5.8 2.2 9 0 3.6-2.4 6.3-5.4 6.3-2.2 0-3.6-1.3-4.6-3.300L41.5 61.500c-1.2-1.8-1.5-3-1.5-5.200z" fill="#fff" />
      <Gloss />
    </Badge>
  );
}

// "Haha" : visage effraye, mains sur les joues.
export function HahaIcon(props) {
  const id = useIds();
  return (
    <Badge {...props} label="haha" defs={<>{faceDefs(id)}<linearGradient id={`${id}-hand`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFD257" /><stop offset="1" stopColor="#F9A93A" /></linearGradient></>}>
      <Face id={id}>
        <path d="M23 24q9-9 19-3.5" fill="none" stroke={INK} strokeWidth="3.6" strokeLinecap="round" />
        <path d="M58 20.500q10-5.5 19 3.5" fill="none" stroke={INK} strokeWidth="3.6" strokeLinecap="round" />
        <ellipse cx="32" cy="40" rx="11" ry="14" fill="#fff" stroke="#3B3F58" strokeWidth="3" />
        <ellipse cx="68" cy="40" rx="11" ry="14" fill="#fff" stroke="#3B3F58" strokeWidth="3" />
        <ellipse cx="50" cy="68" rx="9.5" ry="14" fill="#241B33" />
        <path d="M42 75q8 8.5 16 0 0 8-8 8.5-8-.5-8-8.500z" fill="#F0457A" />
        <path d="M13 56c0-9 7-12 12-8 7 5 12 14 12 24 0 7-2 12-5 16C20 80 13 70 13 56z" fill={`url(#${id}-hand)`} stroke="#E8941F" strokeOpacity="0.6" strokeWidth="1.5" />
        <path d="M87 56c0-9-7-12-12-8-7 5-12 14-12 24 0 7 2 12 5 16 7-8 19-18 19-32z" fill={`url(#${id}-hand)`} stroke="#E8941F" strokeOpacity="0.6" strokeWidth="1.5" />
      </Face>
    </Badge>
  );
}

export function WowIcon(props) {
  const id = useIds();
  return (
    <Badge {...props} label="wow" defs={faceDefs(id)}>
      <Face id={id}>
        <path d="M24 33q7-8.5 16-2.5" fill="none" stroke={INK} strokeWidth="3.6" strokeLinecap="round" />
        <path d="M60 30.500q9-6 16 2.5" fill="none" stroke={INK} strokeWidth="3.6" strokeLinecap="round" />
        <ellipse cx="36" cy="49" rx="5.5" ry="8" fill={INK} />
        <ellipse cx="65" cy="49" rx="5.5" ry="8" fill={INK} />
        <ellipse cx="50" cy="71" rx="11.5" ry="14.5" fill="#241B33" />
        <path d="M41.5 78q8.5 9 17 0 0 8.5-8.5 9-8.5-.5-8.5-9z" fill="#F0457A" />
      </Face>
    </Badge>
  );
}

export function SadIcon(props) {
  const id = useIds();
  return (
    <Badge {...props} label="sad" defs={<>{faceDefs(id)}<linearGradient id={`${id}-tear`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#55C3FF" /><stop offset="1" stopColor="#2B8FEA" /></linearGradient></>}>
      <Face id={id}>
        <path d="M21 41q9-1 15-9" fill="none" stroke={INK} strokeWidth="3.6" strokeLinecap="round" />
        <path d="M79 41q-9-1-15-9" fill="none" stroke={INK} strokeWidth="3.6" strokeLinecap="round" />
        <circle cx="36" cy="52" r="9" fill={INK} />
        <circle cx="64" cy="52" r="9" fill={INK} />
        <circle cx="37.5" cy="49.5" r="3" fill="#fff" />
        <circle cx="65.5" cy="49.5" r="3" fill="#fff" />
        <path d="M28 60c5-3 11-3 16 1 3 3 2 9-1 12-3 2-9 3-13 0-5-3-6-9-2-13z" fill={`url(#${id}-tear)`} />
        <path d="M56 61c5-4 11-4 16-1 4 4 3 10-2 13-4 3-10 2-13-1-3-3-3-8-1-11z" fill={`url(#${id}-tear)`} />
        <path d="M35 77q15-13 30 0" fill="none" stroke={INK} strokeWidth="3.8" strokeLinecap="round" />
      </Face>
    </Badge>
  );
}

export function GrrIcon(props) {
  const id = useIds();
  return (
    <Badge {...props} label="grr" defs={
      <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0.25" stopColor="#FF4863" />
        <stop offset="0.75" stopColor="#FF8B4A" />
        <stop offset="1" stopColor="#FFC24A" />
      </linearGradient>
    }>
      <circle cx="50" cy="50" r="48" fill={`url(#${id}-bg)`} />
      <circle cx="50" cy="50" r="47.2" fill="none" stroke="#D9402F" strokeOpacity="0.35" strokeWidth="1.2" />
      <path d="M17 43c11 1 20 4 28 10" fill="none" stroke={INK} strokeWidth="5.5" strokeLinecap="round" />
      <path d="M83 43c-11 1-20 4-28 10" fill="none" stroke={INK} strokeWidth="5.5" strokeLinecap="round" />
      <ellipse cx="34" cy="60" rx="7.5" ry="9" fill={INK} />
      <ellipse cx="66" cy="60" rx="7.5" ry="9" fill={INK} />
      <path d="M44 42l-2-6M47 43l.5-6M56 43l-.5-6M59 42l2-6" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" opacity="0.9" />
      <path d="M36 82q14-14 28 0" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <Gloss />
    </Badge>
  );
}
