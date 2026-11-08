import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getActiveLocale, t } from '@/lib/i18n/runtime';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

let scriptPromise = null;
function loadGoogleScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('ssr'));
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error('load'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

// Bouton "Continuer avec Google" (Google Identity Services). Le jeton recu est
// verifie cote serveur par /api/auth/google.
export default function GoogleButton({ onCredential, disabled = false, text = 'continue_with' }) {
  const holderRef = useRef(null);
  const callbackRef = useRef(onCredential);
  const [state, setState] = useState(CLIENT_ID ? 'loading' : 'unconfigured');
  callbackRef.current = onCredential;

  useEffect(() => {
    if (!CLIENT_ID) return undefined;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !holderRef.current) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (response) => response?.credential && callbackRef.current(response.credential),
          ux_mode: 'popup',
          use_fedcm_for_prompt: true
        });
        const width = Math.min(400, Math.max(200, Math.floor(holderRef.current.offsetWidth || 380)));
        window.google.accounts.id.renderButton(holderRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text,
          width,
          locale: getActiveLocale()
        });
        setState('ready');
      })
      .catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
    };
  }, [text]);

  if (state === 'unconfigured') {
    return (
      <p className="text-xs text-center text-slate-400 border border-dashed border-slate-300 rounded-xl2 px-3 py-3">
        {t("Connexion Google indisponible : renseignez NEXT_PUBLIC_GOOGLE_CLIENT_ID dans le fichier .env.")}
      </p>
    );
  }
  if (state === 'error') {
    return <p className="text-xs text-center text-red-500">{t("Impossible de charger la connexion Google.")}</p>;
  }

  return (
    <div className={`relative flex justify-center min-h-[44px] ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
      {state === 'loading' && <Loader2 size={18} className="animate-spin text-slate-400 self-center absolute" />}
      <div ref={holderRef} className="w-full flex justify-center" />
    </div>
  );
}
