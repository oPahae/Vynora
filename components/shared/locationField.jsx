import { useEffect, useRef, useState } from 'react';
import { MapPin, X, LocateFixed, LoaderCircle } from 'lucide-react';

import { t } from '@/lib/i18n/runtime';

// Champ "Localisation" (inscription et profil).
//  - value / onChange : { location, latitude, longitude } (libelle + coordonnees arrondies).
//  - autoDetect : au premier affichage, remplit le champ d'apres l'IP (ville approximative).
//    Si l'utilisateur ecrit ou vide le champ avant la reponse, le resultat est ignore.
//  - taper un lieu propose des suggestions ; vider le champ retire la localisation.
export default function LocationField({ value, onChange, autoDetect = false, error, variant = 'auth' }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectFailed, setDetectFailed] = useState(false);
  const containerRef = useRef(null);
  const touchedRef = useRef(false);
  const searchEnabledRef = useRef(false);
  const latestValue = useRef(value);
  latestValue.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const text = value?.location || '';

  async function detect(silent) {
    setDetecting(true);
    setDetectFailed(false);
    try {
      const response = await fetch('/api/geo/detect', { cache: 'no-store' });
      const data = await response.json();
      const place = data.success ? data.location : null;
      if (silent && (touchedRef.current || latestValue.current?.location)) return;
      if (place) {
        searchEnabledRef.current = false;
        setOpen(false);
        onChangeRef.current({ location: place.label, latitude: place.latitude, longitude: place.longitude });
      } else if (!silent) {
        setDetectFailed(true);
      }
    } catch (err) {
      if (!silent) setDetectFailed(true);
    } finally {
      setDetecting(false);
    }
  }

  useEffect(() => {
    if (autoDetect && !latestValue.current?.location) detect(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Suggestions : seulement apres une saisie de l'utilisateur.
  useEffect(() => {
    const term = text.trim();
    if (!searchEnabledRef.current || term.length < 2) {
      setSuggestions([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/geo/search?q=${encodeURIComponent(term)}`);
        const data = await response.json();
        if (!cancelled) {
          setSuggestions(data.success ? data.places : []);
          setOpen(true);
        }
      } catch (err) {
        if (!cancelled) setSuggestions([]);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [text]);

  function handleInput(event) {
    touchedRef.current = true;
    searchEnabledRef.current = true;
    setDetectFailed(false);
    // Texte libre : les coordonnees precedentes ne sont plus valables.
    onChange({ location: event.target.value.slice(0, 150), latitude: null, longitude: null });
  }

  function handlePick(place) {
    searchEnabledRef.current = false;
    setOpen(false);
    setSuggestions([]);
    onChange({ location: place.label, latitude: place.latitude, longitude: place.longitude });
  }

  function handleClear() {
    touchedRef.current = true;
    searchEnabledRef.current = false;
    setOpen(false);
    setSuggestions([]);
    setDetectFailed(false);
    onChange({ location: '', latitude: null, longitude: null });
  }

  const wrapperClass =
    variant === 'auth'
      ? `group flex items-center gap-3 h-12 rounded-xl2 border bg-surface px-4 transition-all ${
          error
            ? 'border-red-400 shadow-[0_0_0_4px_rgb(239_68_68/0.12)]'
            : 'border-slate-200 hover:border-slate-300 focus-within:border-brand-500 focus-within:shadow-ring'
        }`
      : `group flex items-center gap-2.5 rounded-xl2 border bg-slate-50 px-3.5 py-2.5 transition-all focus-within:bg-surface focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/10 ${
          error ? 'border-red-400' : 'border-slate-200'
        }`;

  return (
    <div ref={containerRef} className="relative">
      <div className={wrapperClass}>
        <MapPin size={variant === 'auth' ? 18 : 16} className="text-slate-400 shrink-0 transition-colors group-focus-within:text-brand-500" />
        <input
          type="text"
          value={text}
          onChange={handleInput}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={detecting ? t("Detection de votre position...") : t("Ville, pays")}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          className={`w-full bg-transparent text-slate-900 placeholder:text-slate-400 outline-none ${variant === 'auth' ? 'h-full text-[0.95rem]' : 'text-sm'}`}
        />
        {detecting && <LoaderCircle size={16} className="animate-spin text-slate-400 shrink-0" />}
        {!detecting && text && (
          <button
            type="button"
            onClick={handleClear}
            title={t("Vider le champ")}
            aria-label={t("Vider le champ")}
            className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        )}
        {!detecting && !text && (
          <button
            type="button"
            onClick={() => detect(false)}
            title={t("Detecter ma position")}
            aria-label={t("Detecter ma position")}
            className="text-slate-400 hover:text-brand-600 transition-colors shrink-0"
          >
            <LocateFixed size={16} />
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute inset-x-0 mt-1.5 z-30 overflow-hidden rounded-xl2 border border-slate-100 bg-surface py-1 shadow-card" role="listbox">
          {suggestions.map((place) => (
            <li key={`${place.label}-${place.latitude}-${place.longitude}`}>
              <button
                type="button"
                onClick={() => handlePick(place)}
                className="w-full text-start px-4 py-2 text-sm hover:bg-slate-50 transition-colors"
              >
                <span className="font-medium text-slate-800">{place.label}</span>
                {place.detail && <span className="block text-xs text-slate-400">{place.detail}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-red-500 text-xs mt-1.5 ms-1">{error}</p>}
      {!error && detectFailed && (
        <p className="text-xs text-slate-400 mt-1.5 ms-1">{t("Impossible de detecter votre position. Saisissez votre ville.")}</p>
      )}
    </div>
  );
}
