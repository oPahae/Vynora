import { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';

// Inclinaison 3D : la surface pivote vers le curseur (ressort), avec un reflet
// de lumiere qui glisse. Sert la hierarchie : a reserver aux objets "heros".
export default function Tilt({ children, max = 8, glare = false, className = '', style }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const spring = { stiffness: 220, damping: 22, mass: 0.5 };
  const rotateY = useSpring(useTransform(px, [0, 1], [-max, max]), spring);
  const rotateX = useSpring(useTransform(py, [0, 1], [max, -max]), spring);

  if (reduce) return <div className={className} style={style}>{children}</div>;

  function onMove(event) {
    if (event.pointerType !== 'mouse' || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    px.set((event.clientX - rect.left) / rect.width);
    py.set((event.clientY - rect.top) / rect.height);
  }
  function reset() {
    px.set(0.5);
    py.set(0.5);
  }

  return (
    <div style={{ perspective: 1000 }}>
      <motion.div
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={reset}
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d', ...style }}
        className={`group relative ${className}`}
      >
        {children}
      </motion.div>
    </div>
  );
}
