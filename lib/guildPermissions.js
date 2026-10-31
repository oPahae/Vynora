import { t } from '@/lib/i18n/runtime';
// Permissions des serveurs : masque de bits stocke dans guildRole.permissions.
// Fichier sans dependance serveur : importable aussi cote navigateur (UI).
export const PERMISSIONS = {
  ADMINISTRATOR: 1 << 0,
  MANAGE_GUILD: 1 << 1,
  MANAGE_CHANNELS: 1 << 2,
  MANAGE_ROLES: 1 << 3,
  MANAGE_MESSAGES: 1 << 4,
  KICK_MEMBERS: 1 << 5,
  CREATE_INVITE: 1 << 6,
  SEND_MESSAGES: 1 << 7,
  CONNECT: 1 << 8,
  SPEAK: 1 << 9,
  VIDEO: 1 << 10,
  SCREEN_SHARE: 1 << 11,
  MUTE_MEMBERS: 1 << 12,
  MANAGE_SLOWMODE: 1 << 13,
  BYPASS_SLOWMODE: 1 << 14
};

export const PERMISSION_LABELS = {
  get ADMINISTRATOR() { return t("Administrateur (toutes les permissions)"); },
  get MANAGE_GUILD() { return t("Gerer le serveur"); },
  get MANAGE_CHANNELS() { return t("Gerer les salons et categories"); },
  get MANAGE_ROLES() { return t("Gerer les roles"); },
  get MANAGE_MESSAGES() { return t("Supprimer les messages des autres"); },
  get KICK_MEMBERS() { return t("Expulser des membres"); },
  get CREATE_INVITE() { return t("Creer des invitations"); },
  get SEND_MESSAGES() { return t("Envoyer des messages"); },
  get CONNECT() { return t("Rejoindre les salons vocaux"); },
  get SPEAK() { return t("Parler en vocal"); },
  get VIDEO() { return t("Activer la camera"); },
  get SCREEN_SHARE() { return t("Partager son ecran"); },
  get MUTE_MEMBERS() { return t("Rendre muets les autres membres"); },
  get MANAGE_SLOWMODE() { return t("Regler le mode lent des salons"); },
  get BYPASS_SLOWMODE() { return t("Ignorer le mode lent"); }
};

export const ALL_PERMISSIONS = Object.values(PERMISSIONS).reduce((mask, bit) => mask | bit, 0);

export const DEFAULT_EVERYONE_PERMISSIONS =
  PERMISSIONS.SEND_MESSAGES |
  PERMISSIONS.CONNECT |
  PERMISSIONS.SPEAK |
  PERMISSIONS.VIDEO |
  PERMISSIONS.SCREEN_SHARE |
  PERMISSIONS.CREATE_INVITE;

// L'administrateur (ou le proprietaire) a toutes les permissions.
export function hasPermission(mask, permission) {
  if (mask & PERMISSIONS.ADMINISTRATOR) return true;
  return (mask & permission) === permission;
}
