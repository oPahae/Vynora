import { motion } from 'framer-motion';

// Apparition echelonnee d'une liste : chaque element monte avec un leger decalage.
// A utiliser sur les grilles de cartes (suggestions, amis), pas sur les longs fils.
const list = { hidden: {}, show: { transition: { staggerChildren: 0.055, delayChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 14, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 380, damping: 30 } } };

export function StaggerList({ children, className = '' }) {
  return (
    <motion.div variants={list} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className = '' }) {
  return (
    <motion.div variants={item} className={className}>
      {children}
    </motion.div>
  );
}
