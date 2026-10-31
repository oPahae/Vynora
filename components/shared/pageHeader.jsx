import { motion } from 'framer-motion';

// En-tete de page : un titre, une ligne de contexte, et l'action principale a droite.
// Meme structure sur tous les ecrans pour que l'utilisateur sache toujours ou il est.
// La pastille d'icone diffuse une lueur et pivote au survol ; un filet degrade
// separe l'en-tete du contenu sans ajouter de boite.
export default function PageHeader({ icon: Icon, title, subtitle, actions, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`relative flex items-center justify-between gap-4 mb-6 sm:mb-8 pb-5 ${className}`}
    >
      <div className="flex items-center gap-4 min-w-0">
        {Icon && (
          <span className="group relative shrink-0">
            <span className="relative w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center transition-transform duration-500 ease-spring-soft hover:rotate-[-8deg] hover:scale-105">
              <Icon size={22} strokeWidth={1.9} />
            </span>
          </span>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-[2rem] font-semibold text-slate-900 leading-[1.1] tracking-[-0.035em] truncate">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-1 truncate">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      <span aria-hidden className="absolute bottom-0 inset-x-0 h-px bg-slate-200" />
    </motion.div>
  );
}
