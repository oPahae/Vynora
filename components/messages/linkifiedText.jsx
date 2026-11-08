import { Fragment } from 'react';
import { useConfirm } from '@/lib/confirmContext';
import { analyzeLink, normalizeUrl } from '@/lib/linkSafety';
import { t } from '@/lib/i18n/runtime';

const SPLIT_REGEX = /(\bhttps?:\/\/[^\s<>"'`]+|\bwww\.[^\s<>"'`]+)/gi;

// Separe la ponctuation finale du lien ("voir https://x.com.").
function splitTrailing(token) {
  const match = /^(.*?)([)\].,;:!?'"»”]*)$/u.exec(token);
  return match ? [match[1], match[2]] : [token, ''];
}

// Ouvre un lien ; demande confirmation s'il est juge suspect.
export function useSafeOpen() {
  const confirm = useConfirm();
  return async function open(url) {
    const parsed = normalizeUrl(url);
    if (!parsed) return;
    const analysis = analyzeLink(url);
    if (analysis.suspicious) {
      const ok = await confirm({
        title: t("Suspicious link"),
        message: t("Ce lien semble dangereux ({host}). Il peut s'agir d'une tentative d'hameconnage. Voulez-vous vraiment l'ouvrir ?", {
          host: analysis.displayHost || parsed.hostname
        }),
        confirmLabel: t("Ouvrir quand meme"),
        danger: true
      });
      if (!ok) return;
    }
    window.open(parsed.toString(), '_blank', 'noopener,noreferrer');
  };
}

// Texte de message avec liens cliquables (et prudents).
export default function LinkifiedText({ text, className = '', tone = 'light' }) {
  const openSafely = useSafeOpen();
  const parts = String(text || '').split(SPLIT_REGEX);

  return (
    <p className={`text-sm whitespace-pre-wrap break-words ${className}`}>
      {parts.map((part, index) => {
        if (index % 2 === 0) return <Fragment key={index}>{part}</Fragment>;
        const [url, trailing] = splitTrailing(part);
        const risky = analyzeLink(url).suspicious;
        return (
          <Fragment key={index}>
            <a
              href={normalizeUrl(url)?.toString() || '#'}
              onClick={(event) => {
                event.preventDefault();
                openSafely(url);
              }}
              target="_blank"
              rel="noopener noreferrer nofollow ugc"
              className={`underline underline-offset-2 break-all ${
                risky ? (tone === 'dark' ? 'text-red-200 decoration-red-300' : 'text-red-600 decoration-red-400') : ''
              }`}
            >
              {url}
            </a>
            {trailing}
          </Fragment>
        );
      })}
    </p>
  );
}
