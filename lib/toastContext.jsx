import { createContext, useCallback, useContext, useRef, useState } from 'react';

import { t } from '@/lib/i18n/runtime';
const ToastContext = createContext(null);
const TOAST_DURATION = 5000;

let idCounter = 0;

function playChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    [880, 1320].forEach((freq, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = freq;
      const start = now + index * 0.09;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.24);
    });

    setTimeout(() => ctx.close().catch(() => {}), 500);
  } catch (error) {
    // Lecture audio non disponible (autoplay bloque, navigateur incompatible...)
  }
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timeoutsRef = useRef({});

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    if (timeoutsRef.current[id]) {
      clearTimeout(timeoutsRef.current[id]);
      delete timeoutsRef.current[id];
    }
  }, []);

  const showToast = useCallback(
    ({ title, message, type = 'info', avatar, href, playSound = true } = {}) => {
      const id = `toast-${Date.now()}-${idCounter++}`;
      setToasts((prev) => [...prev, { id, title, message, type, avatar, href, duration: TOAST_DURATION }]);
      if (playSound) playChime();
      timeoutsRef.current[id] = setTimeout(() => removeToast(id), TOAST_DURATION);
      return id;
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>{children}</ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error(t("useToast doit etre utilise a l'interieur de ToastProvider"));
  }
  return context;
}
