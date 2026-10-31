// Nom de l'application, utilise partout dans l'UI (titres de page, logo, footer...).
// Modifier cette seule valeur suffit pour renommer l'application.
export const APP_NAME = 'Vynora';

export function pageTitle(part) {
  return part ? `${part} - ${APP_NAME}` : APP_NAME;
}

// Duree maximale (en secondes) d'une video de story. Contrairement aux posts
// et aux messages, les stories ne sont pas limitees en taille de fichier mais
// en duree : 5 minutes maximum.
export const STORY_MAX_VIDEO_DURATION_SECONDS = 5 * 60;
