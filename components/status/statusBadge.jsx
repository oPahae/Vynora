import { memo } from 'react';
import StatusIcon from './statusIcon';

// Affiche "icone label", tronque proprement. `size` controle la taille du texte.
function StatusBadge({ status, size = 'sm', className = '' }) {
  if (!status || !status.label) return null;

  const sizeClasses = size === 'xs' ? 'text-xs' : 'text-sm';
  const iconSize = size === 'xs' ? 12 : 14;

  return (
    <span className={`inline-flex items-center gap-1 text-slate-500 truncate ${sizeClasses} ${className}`}>
      {status.emoji && <StatusIcon name={status.emoji} size={iconSize} className="shrink-0" />}
      <span className="truncate">{status.label}</span>
    </span>
  );
}

export default memo(StatusBadge);
