// Construit une URL de telechargement force (Content-Disposition: attachment)
// a partir d'une URL /api/media/:id. Cote client uniquement (pas d'import de
// lib/upload.js ici, qui depend de modules Node comme formidable).
export function downloadUrl(url, filename) {
  if (!url) return url;
  const params = new URLSearchParams({ download: '1' });
  if (filename) params.set('filename', filename);
  return `${url}${url.includes('?') ? '&' : '?'}${params.toString()}`;
}
