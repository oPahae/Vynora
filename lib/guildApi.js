import { getUserFromRequest } from '@/lib/auth';
import { getMemberContext, getChannel, canViewChannel } from '@/lib/guilds';

import { t } from '@/lib/i18n/runtime';
// Petits utilitaires communs aux routes /api/guilds/*. Chaque fonction
// repond elle-meme en cas d'echec et renvoie null : l'appelant n'a qu'a
// faire `if (!x) return;`.

export function allowMethods(req, res, methods) {
  if (methods.includes(req.method)) return true;
  res.setHeader('Allow', methods);
  res.status(405).json({ success: false, message: t("Methode non autorisee") });
  return false;
}

export async function requireUser(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    res.status(401).json({ success: false, message: t("Non authentifie") });
    return null;
  }
  return payload.id;
}

// Utilisateur authentifie ET membre du serveur indique dans l'URL.
export async function requireMember(req, res) {
  const userId = await requireUser(req, res);
  if (!userId) return null;
  const guildId = Number(req.query.id);
  if (!Number.isInteger(guildId) || guildId <= 0) {
    res.status(400).json({ success: false, message: t("Serveur invalide") });
    return null;
  }
  const context = await getMemberContext(guildId, userId);
  if (!context) {
    res.status(404).json({ success: false, message: t("Serveur introuvable") });
    return null;
  }
  return { userId, guildId, context };
}

export function denyUnless(res, allowed, message = t("Vous n'avez pas la permission de faire cela")) {
  if (allowed) return true;
  res.status(403).json({ success: false, message });
  return false;
}

// Salon de l'URL, appartenant au serveur, et visible par le membre.
export async function requireChannel(req, res, member) {
  const channelId = Number(req.query.channelId);
  const channel = Number.isInteger(channelId) ? await getChannel(channelId) : null;
  if (!channel || channel.guildId !== member.guildId || !(await canViewChannel(member.context, channel, member.userId))) {
    res.status(404).json({ success: false, message: t("Salon introuvable") });
    return null;
  }
  return channel;
}

export function cleanName(value, max) {
  return (value || '').toString().trim().replace(/\s+/g, ' ').slice(0, max);
}

export function toIdList(value) {
  return Array.isArray(value) ? [...new Set(value.map(Number).filter((n) => Number.isInteger(n) && n > 0))] : [];
}
