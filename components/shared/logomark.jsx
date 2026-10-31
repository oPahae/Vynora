// Marque Nexus : un noeud central, son orbite et deux satellites — un reseau
// reduit a l'essentiel. Tuile pleine, sans degrade, identique dans les deux themes.
export default function Logomark({ size = 36, className = '' }) {
  return (
    <div
      className={`relative shrink-0 flex items-center justify-center ${className}`}
      style={{ width: size, height: size, borderRadius: size * 0.34, backgroundColor: '#3D63E8' }}
    >
      <svg width={size * 0.66} height={size * 0.66} viewBox="0 0 24 24" fill="none" className="relative" aria-hidden>
        <ellipse cx="12" cy="12" rx="9" ry="4.6" transform="rotate(-28 12 12)" stroke="white" strokeOpacity="0.6" strokeWidth="1.4" />
        <circle cx="12" cy="12" r="3.2" fill="white" />
        <circle cx="20.2" cy="9.4" r="1.9" fill="#FFC857" />
        <circle cx="3.8" cy="14.6" r="1.6" fill="#BBCCFB" />
      </svg>
    </div>
  );
}
