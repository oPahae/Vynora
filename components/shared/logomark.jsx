// Logo Vynora : le "V" en orbite. L'image est posee sur une tuile blanche
// arrondie, ce qui la garde fidele et lisible aussi bien en theme clair que
// sombre, ou sur le panneau cobalt de la page de connexion.
export default function Logomark({ size = 36, className = '' }) {
  return (
    <span
      className={`relative shrink-0 inline-flex items-center justify-center overflow-hidden ${className}`}
      style={{ width: size, height: size, borderRadius: size * 0.26 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="Vynora"
        width={size}
        height={size}
        draggable={false}
        className="block w-full h-full object-contain select-none"
      />
    </span>
  );
}
