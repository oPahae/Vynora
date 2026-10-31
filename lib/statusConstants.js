import { t } from '@/lib/i18n/runtime';
// Constantes partagees entre le client et le serveur pour le statut
// personnalise. Ce fichier ne doit importer aucun module serveur (pas de
// './db') afin de pouvoir etre importe depuis des composants React client.

// Le champ `emoji` (nom historique, conserve pour la BDD/API) contient en
// realite le nom d'une icone lucide-react (voir components/status/statusIcon.jsx)
// afin d'avoir un rendu visuel homogene plutot que des emojis natifs, qui
// donnent un rendu incoherent selon l'OS/le navigateur.
export const STATUS_PRESETS = [
  { emoji: 'Code2', get label() { return t("En train de coder"); } },
  { emoji: 'Gamepad2', get label() { return t("En train de jouer"); } },
  { emoji: 'BookOpen', get label() { return t("En train d'etudier"); } },
  { emoji: 'Music2', get label() { return t("En train d'ecouter de la musique"); } },
  { emoji: 'MoonStar', get label() { return t("Ne pas deranger"); } }
];

// Icones proposees dans le selecteur de statut personnalise.
export const STATUS_ICON_CHOICES = [
  'Code2',
  'Gamepad2',
  'BookOpen',
  'Music2',
  'MoonStar',
  'Coffee',
  'Dumbbell',
  'Plane',
  'Car',
  'Briefcase',
  'Heart',
  'Star',
  'Sun',
  'Cloud',
  'Utensils',
  'Home'
];

// Duree des options d'expiration facultatives, en minutes. `null` = jusqu'a
// modification manuelle.
export const STATUS_DURATIONS = {
  '1h': 60,
  '4h': 4 * 60,
  today: 'today',
  none: null
};

export function computeExpiresAt(durationKey) {
  if (!durationKey || durationKey === 'none') return null;
  if (durationKey === 'today') {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return end;
  }
  const minutes = STATUS_DURATIONS[durationKey];
  if (typeof minutes !== 'number') return null;
  return new Date(Date.now() + minutes * 60 * 1000);
}
