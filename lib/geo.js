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
  const lat = Number(headers['x-vercel-ip-latitude']);
  const lng = Number(headers['x-vercel-ip-longitude']);
  return {
    city: city ? decode(city) : null,
    region: headers['x-vercel-ip-country-region'] ? decode(headers['x-vercel-ip-country-region']) : null,
    country: countryName,
    latitude: Number.isFinite(lat) && headers['x-vercel-ip-latitude'] ? lat : null,
    longitude: Number.isFinite(lng) && headers['x-vercel-ip-longitude'] ? lng : null
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
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(clean)}?fields=success,city,region,country,latitude,longitude`, {
      signal: AbortSignal.timeout(2500)
    });
    const data = await response.json();
    const value = data && data.success !== false
      ? {
          city: data.city || null,
          region: data.region || null,
          country: data.country || null,
          latitude: Number.isFinite(Number(data.latitude)) ? Number(data.latitude) : null,
          longitude: Number.isFinite(Number(data.longitude)) ? Number(data.longitude) : null
        }
      : { city: null, region: null, country: null, latitude: null, longitude: null };
    cache.set(clean, { at: Date.now(), value });
    return value;
  } catch (error) {
    return { city: null, region: null, country: null, latitude: null, longitude: null };
  }
}

export function formatLocation(location) {
  if (!location) return '';
  return [location.city, location.country].filter(Boolean).join(', ');
}

// ---------------------------------------------------------------------------
// Localisation de l'utilisateur (gens proches)
// ---------------------------------------------------------------------------

export const LOCATION_MAX_LENGTH = 150;

export function isValidCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return (
    latitude !== null && latitude !== undefined && latitude !== '' &&
    longitude !== null && longitude !== undefined && longitude !== '' &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  );
}

// Les coordonnees sont arrondies a ~1 km (2 decimales) : suffisant pour
// detecter des personnes proches, sans conserver une position exacte.
export function roundCoordinate(value) {
  return Math.round(Number(value) * 100) / 100;
}

const placeCache = new Map();
const PLACE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Recherche de lieux (villes) par nom : API publique Open-Meteo, sans cle.
// Toute erreur renvoie une liste vide.
export async function searchPlaces(queryText, language = 'fr', count = 5) {
  const term = String(queryText || '').trim().slice(0, 80);
  if (term.length < 2) return [];
  const lang = ['fr', 'en', 'es', 'it', 'ja', 'zh', 'ar', 'ru'].includes(language) ? language : 'en';
  const cacheKey = `${lang}:${term.toLowerCase()}`;
  const cached = placeCache.get(cacheKey);
  if (cached && Date.now() - cached.at < PLACE_CACHE_TTL_MS) return cached.value;

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(term)}&count=${count}&language=${lang}&format=json`;
    const response = await fetch(url, { signal: AbortSignal.timeout(3500) });
    const data = await response.json();
    const seen = new Set();
    const value = (Array.isArray(data?.results) ? data.results : [])
      .filter((place) => isValidCoordinates(place.latitude, place.longitude))
      .map((place) => {
        const label = [place.name, place.country].filter(Boolean).join(', ').slice(0, LOCATION_MAX_LENGTH);
        return {
          label,
          detail: [place.admin1, place.country].filter(Boolean).join(', '),
          latitude: roundCoordinate(place.latitude),
          longitude: roundCoordinate(place.longitude)
        };
      })
      .filter((place) => {
        const key = `${place.label}|${place.detail}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    if (placeCache.size > 2000) placeCache.clear();
    placeCache.set(cacheKey, { at: Date.now(), value });
    return value;
  } catch (error) {
    return [];
  }
}

// Valide la localisation envoyee par un formulaire (inscription, profil).
// - champ vide                  => localisation retiree (tout a NULL)
// - libelle + coordonnees       => conservees (arrondies)
// - libelle sans coordonnees    => on tente de les retrouver par le nom du lieu
// Retourne { ok, value: { location, latitude, longitude } } ou { ok: false, error }.
export async function resolveLocationInput(input = {}, language = 'fr') {
  const label = String(input.location || '').trim().slice(0, LOCATION_MAX_LENGTH);
  if (!label) return { ok: true, value: { location: null, latitude: null, longitude: null } };

  if (isValidCoordinates(input.latitude, input.longitude)) {
    return {
      ok: true,
      value: { location: label, latitude: roundCoordinate(input.latitude), longitude: roundCoordinate(input.longitude) }
    };
  }

  const places = await searchPlaces(label, language, 1);
  if (places.length === 0) {
    return { ok: false, error: 'Lieu introuvable : choisissez une suggestion ou videz le champ' };
  }
  return { ok: true, value: { location: label, latitude: places[0].latitude, longitude: places[0].longitude } };
}
