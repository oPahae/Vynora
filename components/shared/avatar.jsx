import Image from 'next/image';

const SIZES = { xs: 22, sm: 32, md: 40, lg: 56, xl: 96, xxl: 140 };

// Couleurs d'identite (aplats) : chaque personne a sa couleur, stable d'un ecran a l'autre.
const COLORS = ['#3D63E8', '#0E9F8A', '#E8590C', '#D6336C', '#7048E8', '#1C7ED6', '#2F9E44', '#C77700'];

function getInitials(firstName, lastName) {
  const first = (firstName || '?').charAt(0);
  const last = (lastName || '').charAt(0);
  return `${first}${last}`.toUpperCase();
}

function pickColor(firstName, lastName) {
  const seed = `${firstName || ''}${lastName || ''}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length];
}

export default function Avatar({ src, firstName, lastName, size = 'md', ring = false }) {
  const pixelSize = SIZES[size] || SIZES.md;

  return (
    <div
      className={`relative shrink-0 rounded-full overflow-hidden flex items-center justify-center text-white font-semibold font-display ${
        ring ? 'ring-4 ring-surface' : 'ring-1 ring-inset ring-black/5 dark:ring-white/10'
      }`}
      style={{
        width: pixelSize,
        height: pixelSize,
        fontSize: pixelSize * 0.38,
        backgroundColor: src ? undefined : pickColor(firstName, lastName)
      }}
    >
      {src ? (
        <Image src={src} alt={`${firstName} ${lastName}`} fill sizes={`${pixelSize}px`} className="object-cover" />
      ) : (
        <span aria-hidden>{getInitials(firstName, lastName)}</span>
      )}
    </div>
  );
}
