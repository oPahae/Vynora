import { useEffect } from 'react';

// Lumiere du curseur : un seul ecouteur global pose --mx / --my (en px, relatifs
// a l'element) sur la carte survolee et ses parents lumineux. Le rendu (halo
// interne + liseré) est entierement en CSS (.nx-card / .nx-spot).
// - uniquement pour les pointeurs precis (souris / trackpad) : rien sur mobile ;
// - throttle par requestAnimationFrame, ecouteur passif, aucune ecriture de layout.
const SELECTOR = '.nx-card, .nx-spot';

export default function CursorLight() {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return undefined;

    let frame = 0;
    let lastEvent = null;
    // Le fond ambiant derive tres legerement a l'oppose du curseur (profondeur).
    // Les variables sont posees sur .nx-ambient seulement : pas de recalcul global.
    const ambient = document.querySelector('.nx-ambient');

    function paint() {
      frame = 0;
      const event = lastEvent;
      if (!event || !(event.target instanceof Element)) return;
      if (ambient) {
        ambient.style.setProperty('--px', ((event.clientX / window.innerWidth) * 2 - 1).toFixed(3));
        ambient.style.setProperty('--py', ((event.clientY / window.innerHeight) * 2 - 1).toFixed(3));
      }
      let el = event.target.closest(SELECTOR);
      let depth = 0;
      while (el && depth < 3) {
        const rect = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${event.clientX - rect.left}px`);
        el.style.setProperty('--my', `${event.clientY - rect.top}px`);
        el = el.parentElement ? el.parentElement.closest(SELECTOR) : null;
        depth += 1;
      }
    }

    function onMove(event) {
      lastEvent = event;
      if (!frame) frame = requestAnimationFrame(paint);
    }

    document.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      document.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
