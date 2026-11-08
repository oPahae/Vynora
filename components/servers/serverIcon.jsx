// Image d'un serveur, ou son initiale si aucune image n'est definie.
export default function ServerIcon({ guild, className = '', textClassName = '' }) {
  if (guild.icon) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={guild.icon} alt="" draggable={false} className={`object-cover ${className}`} />
    );
  }
  return <span className={`${className} ${textClassName}`}>{guild.name.charAt(0).toUpperCase()}</span>;
}
