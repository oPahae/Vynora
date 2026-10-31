// Limiteur de debit en memoire (fenetre glissante). Suffisant pour une instance
// unique (serveur Node personnalise) ; a remplacer par Redis si l'application
// est deployee sur plusieurs instances.
const buckets = new Map();

export function rateLimit(key, { max, windowMs }) {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((timestamp) => now - timestamp < windowMs);

  if (hits.length >= max) {
    buckets.set(key, hits);
    return { allowed: false, retryAfterMs: windowMs - (now - hits[0]) };
  }

  hits.push(now);
  buckets.set(key, hits);

  // Nettoyage occasionnel pour eviter que la Map ne grossisse indefiniment.
  if (buckets.size > 5000) {
    for (const [bucketKey, timestamps] of buckets) {
      if (timestamps.every((timestamp) => now - timestamp >= windowMs)) buckets.delete(bucketKey);
    }
  }

  return { allowed: true, retryAfterMs: 0 };
}

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}
