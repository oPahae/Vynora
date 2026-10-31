import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';

// Fil de lumiere en haut de l'ecran pendant une navigation : confirme le clic
// instantanement, puis se resout quand la page est la.
export default function RouteProgress() {
  const router = useRouter();
  const [phase, setPhase] = useState('idle');
  const timer = useRef(null);

  useEffect(() => {
    const start = (url, { shallow } = {}) => {
      if (shallow) return;
      clearTimeout(timer.current);
      setPhase('loading');
    };
    const end = () => {
      setPhase((prev) => (prev === 'loading' ? 'done' : prev));
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setPhase('idle'), 450);
    };
    router.events.on('routeChangeStart', start);
    router.events.on('routeChangeComplete', end);
    router.events.on('routeChangeError', end);
    return () => {
      router.events.off('routeChangeStart', start);
      router.events.off('routeChangeComplete', end);
      router.events.off('routeChangeError', end);
      clearTimeout(timer.current);
    };
  }, [router.events]);

  if (phase === 'idle') return null;
  return (
    <motion.div
      aria-hidden
      className="nx-route-bar"
      initial={{ scaleX: 0, opacity: 1 }}
      animate={phase === 'loading' ? { scaleX: 0.82, opacity: 1 } : { scaleX: 1, opacity: 0 }}
      transition={phase === 'loading' ? { duration: 6, ease: [0.1, 0.8, 0.2, 1] } : { duration: 0.35, ease: 'easeOut' }}
    />
  );
}
