// Nom de l'application, utilise partout dans l'UI (titres de page, logo, footer...).
// Modifier cette seule valeur suffit pour renommer l'application.
export const APP_NAME = 'Vynora';

// Version des termes et conditions (voir pages/terms.jsx et lib/termsContent.js).
// Incrementer TERMS_VERSION quand le texte change de facon substantielle : la
// version acceptee est memorisee pour chaque compte a l'inscription.
export const TERMS_VERSION = '2026-11';
export const TERMS_UPDATED_AT = '2026-11-27';

export function pageTitle(part) {
  return part ? `${part} - ${APP_NAME}` : APP_NAME;
}

// Duree maximale (en secondes) d'une video de story. Contrairement aux posts
// et aux messages, les stories ne sont pas limitees en taille de fichier mais
// en duree : 5 minutes maximum.
export const STORY_MAX_VIDEO_DURATION_SECONDS = 5 * 60;
