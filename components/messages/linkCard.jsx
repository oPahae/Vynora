import { useEffect, useState } from 'react';
import { ShieldAlert, Globe } from 'lucide-react';
import { analyzeLink, normalizeUrl } from '@/lib/linkSafety';
import { useSafeOpen } from '@/components/messages/linkifiedText';
import { t } from '@/lib/i18n/runtime';

// Cache memoire des apercus (evite de re-telecharger a chaque rendu).
const previewCache = new Map();

function loadPreview(url) {
  if (!previewCache.has(url)) {
    previewCache.set(
      url,
      fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
        .then((response) => response.json())
        .then((data) => (data.success ? data.preview : null))
        .catch(() => null)
    );
  }
  return previewCache.get(url);
}

function reasonLabel(code) {
  switch (code) {
    case 'mixed_script':
      return t("Le nom de domaine melange des alphabets (lettres cyrilliques, grecques...) pour imiter un autre site");
    case 'non_latin_host':
      return t("Le nom de domaine contient des lettres cyrilliques ou d'un autre alphabet trompeur");
    case 'ip_host':
      return t("Le lien pointe vers une adresse IP et non vers un vrai site");
    case 'credentials':
      return t("Le lien cache sa vraie destination derriere un faux nom (@)");
    case 'invisible_chars':
      return t("Le lien contient des caracteres invisibles");
    case 'bad_tld':
      return t("Extension de domaine souvent utilisee pour l'arnaque");
    case 'shortener':
      return t("Lien raccourci : sa destination est cachee");
    case 'lookalike':
      return t("Le domaine imite une marque connue");
    case 'many_subdomains':
      return t("Adresse anormalement complexe");
    case 'bait_words':
      return t("Adresse typique d'une page de phishing");
    case 'bad_scheme':
      return t("Type de lien dangereux");
    case 'unusual_port':
      return t("Port inhabituel");
    case 'insecure':
      return t("Connexion non securisee (http) sur une page sensible");
    default:
      return t("Lien invalide ou inhabituel");
  }
}

// Carte d'apercu d'un lien. Le controle de securite est local et immediat ;
// le logo / titre / description viennent du serveur quand ils existent.
export default function LinkCard({ url, tone = 'light' }) {
  const openSafely = useSafeOpen();
  const parsed = normalizeUrl(url);
  const safety = analyzeLink(url);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!parsed || safety.suspicious) return undefined;
    loadPreview(parsed.toString()).then((value) => {
      if (!cancelled) setPreview(value);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  if (!parsed) return null;

  const suspicious = safety.suspicious || Boolean(preview?.suspicious);
  const reasons = safety.suspicious ? safety.reasons : preview?.reasons || [];
  const hasContent = preview && (preview.title || preview.description || preview.image);
  if (!suspicious && !hasContent) return null;

  const host = safety.displayHost || parsed.hostname;
  const border = tone === 'dark' ? 'border-white/25 bg-white/10' : 'border-slate-200 bg-surface';

  return (
    <button
      type="button"
      onClick={() => openSafely(url)}
      className={`block w-full text-start rounded-xl2 overflow-hidden border mt-2 transition-opacity hover:opacity-90 ${
        suspicious ? 'border-red-300 bg-red-50 text-slate-800' : `${border} ${tone === 'dark' ? 'text-white' : 'text-slate-800'}`
      }`}
    >
      {suspicious && (
        <span className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-semibold px-3 py-1.5">
          <ShieldAlert size={14} className="shrink-0" />
          {t("Suspicious link")}
        </span>
      )}

      {!suspicious && preview?.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview.image}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          className="w-full max-h-40 object-cover bg-slate-100"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      )}

      <span className="block px-3 py-2">
        <span className="flex items-center gap-1.5 text-[11px] opacity-80">
          {!suspicious && preview?.favicon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.favicon}
              alt=""
              referrerPolicy="no-referrer"
              width={14}
              height={14}
              className="w-3.5 h-3.5 rounded-sm shrink-0"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <Globe size={13} className="shrink-0" />
          )}
          <span className="truncate">{!suspicious && preview?.siteName ? preview.siteName : host}</span>
        </span>

        {suspicious ? (
          <>
            <span className="block text-xs font-medium text-red-700 mt-1 break-all">{host}</span>
            {reasons.length > 0 && <span className="block text-[11px] text-red-600/90 mt-0.5">{reasonLabel(reasons[0])}</span>}
          </>
        ) : (
          <>
            {preview?.title && <span className="block text-sm font-semibold mt-1 line-clamp-2">{preview.title}</span>}
            {preview?.description && <span className="block text-xs opacity-80 mt-0.5 line-clamp-2">{preview.description}</span>}
          </>
        )}
      </span>
    </button>
  );
}
