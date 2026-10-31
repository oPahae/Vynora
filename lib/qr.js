// Utilitaires QR : le QR d'un profil encode simplement son URL publique
// (<origine>/profile/<id>) ; ainsi l'appareil photo d'un telephone ouvre
// directement le profil, et le scanner integre en extrait l'identifiant.

export function profileUrl(userId, origin) {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/profile/${userId}`;
}

export function extractProfileId(text) {
  if (!text) return null;
  const value = String(text).trim();
  const urlMatch = /\/profile\/(\d{1,10})(?:[/?#]|$)/.exec(value);
  if (urlMatch) return Number(urlMatch[1]);
  const schemeMatch = /^nexus:user:(\d{1,10})$/i.exec(value);
  if (schemeMatch) return Number(schemeMatch[1]);
  return null;
}
