import { useId } from 'react';
import { motion } from 'framer-motion';

// Controle segmente : une seule pastille de verre glisse entre les options
// (spring), ce qui rend le changement d'etat lisible sans texte supplementaire.
export default function Segmented({ items, value, onChange, role = 'tablist', className = '', ariaLabel }) {
  const id = useId();
  const itemRole = role === 'radiogroup' ? 'radio' : 'tab';
  return (
    <div className={`nx-segmented ${className}`} role={role} aria-label={ariaLabel}>
      {items.map((item) => {
        const selected = value === item.key;
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            role={itemRole}
            aria-selected={itemRole === 'tab' ? selected : undefined}
            aria-checked={itemRole === 'radio' ? selected : undefined}
            onClick={() => onChange(item.key)}
            className="nx-segmented-item"
          >
            {selected && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                className="nx-segmented-thumb"
              />
            )}
            {Icon && <Icon size={14} className={`relative ${selected ? 'text-brand-500' : ''}`} />}
            <span className="relative">{item.label}</span>
            {typeof item.count === 'number' && item.count > 0 && (
              <span className="relative nx-tabular text-[11px] font-semibold text-brand-600 bg-brand-50 rounded-full px-1.5 min-w-[18px] h-[18px] inline-flex items-center justify-center">
                {item.count > 99 ? '99+' : item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
