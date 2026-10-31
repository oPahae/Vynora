import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

// Compteur qui "roule" : l'ancienne valeur sort par le haut et la nouvelle monte
// du bas quand le nombre augmente (sens inverse quand il diminue). Un like se
// voit ainsi jusque dans les chiffres.
const variants = {
  enter: (dir) => ({ y: dir * 11, opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (dir) => ({ y: dir * -11, opacity: 0 })
};

export default function AnimatedNumber({ value, className = '' }) {
  const reduce = useReducedMotion();
  const previous = useRef(value);
  const direction = value >= previous.current ? 1 : -1;
  useEffect(() => {
    previous.current = value;
  }, [value]);

  const text = String(value);
  if (reduce) return <span className={`nx-tabular ${className}`}>{text}</span>;

  return (
    <span className={`relative inline-flex overflow-hidden align-bottom leading-[1.35] nx-tabular ${className}`}>
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.span
          key={text}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: 'spring', stiffness: 520, damping: 34 }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
