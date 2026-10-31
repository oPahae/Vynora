import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { t, getActiveLocale } from '@/lib/i18n/runtime';
import { getLocaleMeta } from '@/lib/i18n/config';
// Composant reCAPTCHA v2 (case a cocher), sans dependance externe : le script
// Google est charge une seule fois, puis le widget est rendu dans un conteneur.
// Usage : <Recaptcha ref={ref} siteKey="..." onChange={(token) => ...} />
// ref.current.reset() remet le widget a zero (les jetons sont a usage unique).

let scriptPromise = null;

function loadRecaptchaScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no-window'));
  if (window.grecaptcha && window.grecaptcha.render) return Promise.resolve(window.grecaptcha);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    window.__onRecaptchaLoaded = () => {
      window.grecaptcha.ready(() => resolve(window.grecaptcha));
    };
    const script = document.createElement('script');
    script.src = 'https://www.google.com/recaptcha/api.js?onload=__onRecaptchaLoaded&render=explicit&hl=' + getLocaleMeta(getActiveLocale()).htmlLang;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      scriptPromise = null;
      script.remove();
      reject(new Error('recaptcha-load-failed'));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

const Recaptcha = forwardRef(function Recaptcha({ siteKey, onChange, error }, ref) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetIdRef.current !== null && window.grecaptcha) {
        try {
          window.grecaptcha.reset(widgetIdRef.current);
        } catch (e) {
          // widget deja detruit
        }
      }
      onChangeRef.current?.(null);
    }
  }));

  useEffect(() => {
    if (!siteKey) return undefined;
    let cancelled = false;
    const container = containerRef.current;
    setLoadFailed(false);

    loadRecaptchaScript()
      .then((grecaptcha) => {
        if (cancelled || !container || widgetIdRef.current !== null) return;
        const availableWidth = container.parentElement?.clientWidth || 304;
        widgetIdRef.current = grecaptcha.render(container, {
          sitekey: siteKey,
          theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
          // Le widget "normal" fait 304px de large : version compacte sur petits ecrans.
          size: availableWidth < 304 ? 'compact' : 'normal',
          callback: (token) => onChangeRef.current?.(token),
          'expired-callback': () => onChangeRef.current?.(null),
          'error-callback': () => onChangeRef.current?.(null)
        });
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });

    return () => {
      cancelled = true;
      widgetIdRef.current = null;
      if (container) container.innerHTML = '';
    };
  }, [siteKey, attempt]);

  if (!siteKey) return null;

  return (
    <div>
      <div className="flex justify-center min-h-[78px]">
        <div ref={containerRef} />
      </div>
      {loadFailed && (
        <p className="text-red-500 text-xs mt-1.5 text-center">{t("Impossible de charger le captcha.")}{' '}
          <button type="button" onClick={() => setAttempt((value) => value + 1)} className="underline font-medium">{t("Reessayer")}</button>
        </p>
      )}
      {error && <p className="text-red-500 text-xs mt-1.5 text-center">{error}</p>}
    </div>
  );
});

export default Recaptcha;
