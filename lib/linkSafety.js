// Detection des liens dangereux, utilisable cote navigateur ET cote serveur
// (aucune dependance). Retourne la liste des raisons pour lesquelles un lien
// est juge suspect : liste vide = rien d'anormal detecte.

const URL_REGEX = /\bhttps?:\/\/[^\s<>"'`]+|\bwww\.[^\s<>"'`]+/gi;

// Ponctuation finale qui ne fait pas partie du lien ("voir https://x.com.").
function trimTrailing(url) {
  return url.replace(/[)\].,;:!?'"»”]+$/u, '');
}

// Extrait les liens d'un texte (dedoublonnes, dans l'ordre d'apparition).
export function extractUrls(text) {
  if (!text || typeof text !== 'string') return [];
  const seen = new Set();
  const urls = [];
  (text.match(URL_REGEX) || []).forEach((raw) => {
    const url = trimTrailing(raw);
    if (url && !seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  });
  return urls;
}

export function normalizeUrl(raw) {
  const value = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(value);
  } catch (error) {
    return null;
  }
}

// Scripts "confusables" : lettres qui ressemblent a des lettres latines.
const CYRILLIC = /[\u0400-\u052F\u1C80-\u1C8F\u2DE0-\u2DFF\uA640-\uA69F]/u;
const GREEK = /[\u0370-\u03FF\u1F00-\u1FFF]/u;
const ARMENIAN_CHEROKEE = /[\u0530-\u058F\u13A0-\u13FF]/u;
const LATIN = /[A-Za-z]/;
// Caracteres invisibles / directionnels souvent utilises pour tromper l'oeil.
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF\u00AD]/u;

// Decode le punycode (xn--...) pour montrer le vrai nom a l'utilisateur.
export function decodePunycodeHost(host) {
  try {
    return host
      .split('.')
      .map((label) => (label.startsWith('xn--') ? decodeLabel(label.slice(4)) : label))
      .join('.');
  } catch (error) {
    return host;
  }
}

// Decodeur punycode minimal (RFC 3492).
function decodeLabel(input) {
  const base = 36;
  const tMin = 1;
  const tMax = 26;
  const skew = 38;
  const damp = 700;
  let n = 128;
  let bias = 72;
  let i = 0;
  const output = [];
  let basic = input.lastIndexOf('-');
  if (basic < 0) basic = 0;
  for (let j = 0; j < basic; j += 1) output.push(input.charCodeAt(j));
  const adapt = (delta, numPoints, first) => {
    let k = 0;
    let d = first ? Math.floor(delta / damp) : delta >> 1;
    d += Math.floor(d / numPoints);
    for (; d > ((base - tMin) * tMax) >> 1; k += base) d = Math.floor(d / (base - tMin));
    return Math.floor(k + ((base - tMin + 1) * d) / (d + skew));
  };
  for (let index = basic > 0 ? basic + 1 : 0; index < input.length; ) {
    const oldi = i;
    for (let w = 1, k = base; ; k += base) {
      const c = input.charCodeAt(index++);
      const digit = c - 48 < 10 ? c - 22 : c - 65 < 26 ? c - 65 : c - 97 < 26 ? c - 97 : base;
      i += digit * w;
      const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
      if (digit < t) break;
      w *= base - t;
    }
    const len = output.length + 1;
    bias = adapt(i - oldi, len, oldi === 0);
    n += Math.floor(i / len);
    i %= len;
    output.splice(i++, 0, n);
  }
  return String.fromCodePoint(...output);
}

const SUSPICIOUS_TLDS = new Set([
  'zip', 'mov', 'tk', 'ml', 'ga', 'cf', 'gq', 'top', 'xyz', 'click', 'country', 'kim', 'work', 'loan', 'men',
  'review', 'support', 'rest', 'bid', 'cam', 'icu', 'monster', 'quest', 'cyou', 'buzz'
]);

const URL_SHORTENERS = new Set([
  'bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'ow.ly', 'is.gd', 'buff.ly', 'rebrand.ly', 'cutt.ly', 'shorturl.at',
  'tiny.cc', 'rb.gy', 'v.gd', 'bl.ink', 's.id'
]);

const BRANDS = [
  'google', 'facebook', 'instagram', 'whatsapp', 'paypal', 'apple', 'microsoft', 'amazon', 'netflix', 'twitter',
  'youtube', 'tiktok', 'binance', 'telegram', 'linkedin', 'outlook', 'icloud', 'dropbox'
];

const BAIT_WORDS = /(login|log-in|signin|sign-in|verify|verification|secure|account|update|wallet|password|billing|support|recovery)/i;

// Remplace les chiffres/symboles de substitution : paypa1 -> paypal, g00gle -> google.
function deLeet(value) {
  return value
    .replace(/0/g, 'o')
    .replace(/1/g, 'l')
    .replace(/3/g, 'e')
    .replace(/5/g, 's')
    .replace(/\$/g, 's')
    .replace(/rn/g, 'm');
}

function registrableDomain(hostname) {
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;
  // Heuristique pour les suffixes a deux niveaux (co.uk, com.ma...).
  const secondLevel = ['co', 'com', 'org', 'net', 'gov', 'ac', 'edu'];
  if (parts[parts.length - 2].length <= 3 && secondLevel.includes(parts[parts.length - 2]) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

// Retourne { suspicious, reasons: [codes], host, displayHost }.
// Codes : mixed_script, non_latin_host, ip_host, credentials, invisible_chars,
//         bad_tld, shortener, lookalike, many_subdomains, bait_words, bad_scheme, unusual_port, insecure
export function analyzeLink(raw) {
  const reasons = [];
  const parsed = normalizeUrl(raw);

  if (/^\s*(javascript|data|vbscript|file):/i.test(raw)) {
    return { suspicious: true, reasons: ['bad_scheme'], host: '', displayHost: '' };
  }
  if (!parsed) return { suspicious: true, reasons: ['invalid'], host: '', displayHost: '' };

  const hostname = parsed.hostname.toLowerCase();
  const displayHost = decodePunycodeHost(hostname);
  const rawBody = String(raw).replace(/^https?:\/\//i, '');
  const rawHost = rawBody.split(/[/?#]/)[0];

  // Lettres non latines (cyrillique, grec...) ou melange de scripts dans le domaine.
  const hostForScript = displayHost.replace(/[^\p{L}]/gu, '');
  const hasCyr = CYRILLIC.test(displayHost) || CYRILLIC.test(rawHost);
  const hasGreek = GREEK.test(displayHost) || GREEK.test(rawHost);
  const hasOther = ARMENIAN_CHEROKEE.test(displayHost);
  const hasLatin = LATIN.test(hostForScript);
  if ((hasCyr || hasGreek || hasOther) && hasLatin) reasons.push('mixed_script');
  else if (hasCyr || hasGreek || hasOther) reasons.push('non_latin_host');
  if (INVISIBLE.test(rawBody)) reasons.push('invisible_chars');

  // Adresse IP au lieu d'un nom de domaine.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || /^\[[0-9a-f:]+\]$/i.test(hostname) || /^0x[0-9a-f]+$/i.test(hostname) || /^\d{8,10}$/.test(hostname)) {
    reasons.push('ip_host');
  }

  // https://google.com@evil.com : tout ce qui precede @ est un faux decor.
  if (parsed.username || parsed.password) reasons.push('credentials');

  const labels = hostname.split('.');
  const tld = labels[labels.length - 1];
  if (SUSPICIOUS_TLDS.has(tld)) reasons.push('bad_tld');
  if (URL_SHORTENERS.has(hostname)) reasons.push('shortener');
  if (labels.length >= 5) reasons.push('many_subdomains');

  // Imitation d'une marque connue (paypa1.com, g00gle.com, google-login.net...).
  const domain = registrableDomain(hostname);
  const domainName = domain.split('.')[0];
  const normalized = deLeet(domainName.replace(/-/g, ''));
  for (const brand of BRANDS) {
    const isOfficial = domainName === brand;
    if (isOfficial) continue;
    const lookalike =
      normalized === brand ||
      (normalized.includes(brand) && domainName !== normalized) ||
      (domainName.includes(brand) && domainName !== brand && BAIT_WORDS.test(domainName)) ||
      (labels.slice(0, -2).join('.').includes(brand) && domain.split('.')[0] !== brand);
    if (lookalike) {
      reasons.push('lookalike');
      break;
    }
  }
  if (BAIT_WORDS.test(hostname) && /\d/.test(domainName) === false && labels.length >= 4) reasons.push('bait_words');

  if (parsed.port && !['80', '443'].includes(parsed.port)) reasons.push('unusual_port');
  if (parsed.protocol === 'http:' && BAIT_WORDS.test(parsed.pathname + hostname)) reasons.push('insecure');

  return { suspicious: reasons.length > 0, reasons, host: hostname, displayHost };
}

// Cote serveur : refuse les destinations internes (SSRF) avant de telecharger
// l'apercu d'un lien. Renvoie true si l'hote est une adresse privee/locale.
export function isPrivateHostname(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan')) return true;
  return isPrivateIp(host);
}

export function isPrivateIp(ip) {
  const v = String(ip || '').toLowerCase().replace(/^\[|\]$/g, '');
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(v);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return (
      a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
    );
  }
  if (v.includes(':')) {
    if (v === '::1' || v === '::') return true;
    if (v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb')) return true;
    const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(v);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }
  // Entiers / hexadecimaux deguises (http://2130706433) : consideres internes par prudence.
  if (/^\d+$/.test(v) || /^0x[0-9a-f]+$/.test(v)) return true;
  return false;
}
