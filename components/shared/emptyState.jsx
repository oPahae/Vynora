import { motion } from 'framer-motion';

// Etat vide : une invitation a agir, jamais un simple "rien ici".
// Le pictogramme est pris dans une petite orbite : un satellite lumineux
// tourne lentement autour, comme un noeud du reseau en attente de connexion.
export default function EmptyState({ icon: Icon, title, description, action, tone = 'brand', className = '' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    ember: 'bg-ember-50 text-ember-600',
    neutral: 'bg-slate-100 text-slate-500'
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className={`nx-card px-6 py-12 sm:py-16 text-center overflow-hidden ${className}`}
    >
      {Icon && (
        <div className="relative w-16 h-16 mx-auto mb-8">
          <span aria-hidden className="absolute -inset-5 rounded-full border border-dashed border-slate-300/70" />
          <span aria-hidden className="absolute -inset-5 rounded-full animate-ring-spin" style={{ animationDuration: '18s' }}>
            <span className="absolute top-0 start-1/2 -ms-1 -mt-1 w-2 h-2 rounded-full bg-lumen-400 shadow-lumenGlow" />
          </span>
          <span className={`absolute inset-0 rounded-2xl rotate-6 opacity-50 ${tones[tone] || tones.brand}`} />
          <span
            className={`relative w-16 h-16 rounded-2xl flex items-center justify-center ${tones[tone] || tones.brand}`}
            
          >
            <Icon size={26} strokeWidth={1.8} className="animate-float" />
          </span>
        </div>
      )}
      {title && <h3 className="font-display text-base font-semibold text-slate-900 text-balance">{title}</h3>}
      {description && <p className="text-sm text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed text-pretty">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </motion.div>
  );
}
