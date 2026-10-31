// Localisation approximative d'une adresse IP (ville / region / pays).
//  1. En-tetes poses par un CDN / hebergeur s'ils existent (Cloudflare, Vercel...).
//  2. Sinon service public ipwho.is (HTTPS, sans cle), avec delai court et cache.
// Toute erreur renvoie simplement une localisation inconnue : une connexion ne
// doit jamais echouer a cause de la geolocalisation.

const cache = new Map();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export function normalizeIp(ip) {
  if (!ip) return null;
  let value = String(ip).trim();
  if (value.startsWith('::ffff:')) value = value.slice(7);
  return value || null;
}

export function isPrivateIp(ip) {
  if (!ip) return true;
  return (
    ip === '::1' ||
    ip === 'unknown' ||
    /^127\./.test(ip) ||
    /^10\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    /^169\.254\./.test(ip) ||
    /^f[cd][0-9a-f]{2}:/i.test(ip) ||
    /^fe80:/i.test(ip)
  );
}

function fromHeaders(headers) {
  const country = headers['x-vercel-ip-country'] || headers['cf-ipcountry'];
  const city = headers['x-vercel-ip-city'] || headers['cf-ipcity'];
  if (!country || country === 'XX') return null;
  const decode = (value) => {
    try {
      return decodeURIComponent(String(value));
    } catch (error) {
      return String(value);
    }
  };
  const countryValue = decode(country);
  let countryName = countryValue;
  if (/^[A-Za-z]{2}$/.test(countryValue)) {
    try {
      countryName = new Intl.DisplayNames(['fr'], { type: 'region' }).of(countryValue.toUpperCase()) || countryValue;
    } catch (error) {
      countryName = countryValue;
    }
  }
  return {
    city: city ? decode(city) : null,
    region: headers['x-vercel-ip-country-region'] ? decode(headers['x-vercel-ip-country-region']) : null,
    country: countryName
  };
}

export async function locateIp(ip, headers = {}) {
  const fromCdn = fromHeaders(headers);
  if (fromCdn) return fromCdn;

  const clean = normalizeIp(ip);
  if (isPrivateIp(clean)) return { city: null, region: null, country: null, local: true };

  const cached = cache.get(clean);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(clean)}?fields=success,city,region,country`, {
      signal: AbortSignal.timeout(2500)
    });
    const data = await response.json();
    const value = data && data.success !== false
      ? { city: data.city || null, region: data.region || null, country: data.country || null }
      : { city: null, region: null, country: null };
    cache.set(clean, { at: Date.now(), value });
    return value;
  } catch (error) {
    return { city: null, region: null, country: null };
  }
}

export function formatLocation(location) {
  if (!location) return '';
  return [location.city, location.country].filter(Boolean).join(', ');
}
