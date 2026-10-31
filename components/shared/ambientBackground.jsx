// Fond ambiant "Lumen" : trois nappes de lumiere et un grain tres fin.
// Purement decoratif (aria-hidden), anime en transform uniquement (voir globals.css).
export default function AmbientBackground() {
  return (
    <div className="nx-ambient" aria-hidden>
      <span className="nx-ambient__orb nx-ambient__orb--a" />
      <span className="nx-ambient__orb nx-ambient__orb--b" />
      <span className="nx-ambient__orb nx-ambient__orb--c" />
    </div>
  );
}
