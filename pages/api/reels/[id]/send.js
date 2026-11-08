import { getUserFromRequest } from '@/lib/auth';
import { getVisibleReelRow } from '@/lib/reels';
import { sendDirectMessage } from '@/lib/directMessages';
import { rateLimit } from '@/lib/rateLimit';

const MAX_TARGETS = 10;

// Envoyer un reel a un ou plusieurs amis en message prive.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) return res.status(401).json({ success: false, message: 'Non authentifie' });

  const reelId = Number(req.query.id);
  if (!Number.isInteger(reelId)) return res.status(422).json({ success: false, message: 'Requete invalide' });

  const targetUserIds = [
    ...new Set(
      (Array.isArray(req.body?.targetUserIds) ? req.body.targetUserIds : [])
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0 && id !== payload.id)
    )
  ].slice(0, MAX_TARGETS);
  if (targetUserIds.length === 0) {
    return res.status(422).json({ success: false, message: 'Choisissez au moins un destinataire' });
  }
  const content = (req.body?.content || '').toString().trim().slice(0, 500) || null;

  const limit = rateLimit(`reel-send:${payload.id}`, { max: 60, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) return res.status(429).json({ success: false, message: 'Trop d\'envois, reessayez plus tard' });

  try {
    const reel = await getVisibleReelRow(payload.id, reelId);
    if (!reel) return res.status(404).json({ success: false, message: 'Reel introuvable' });

    const sent = [];
    for (const targetUserId of targetUserIds) {
      // eslint-disable-next-line no-await-in-loop
      const result = await sendDirectMessage({ senderId: payload.id, targetUserId, content, type: 'reel', reelId });
      if (result.success) sent.push({ userId: targetUserId, conversationId: result.conversationId });
    }

    if (sent.length === 0) {
      return res.status(422).json({ success: false, message: "Le reel n'a pu etre envoye a aucun destinataire" });
    }
    return res.status(201).json({ success: true, sent });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
