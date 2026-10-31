import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { getOrCreateDirectConversation, getConversationSummaries, getOtherParticipants } from '@/lib/conversations';
import { getFriendRow, getBlockStatus } from '@/lib/friends';

export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  if (req.method === 'GET') {
    try {
      const archived = req.query.archived === '1' || req.query.archived === 'true';
      const summaries = await getConversationSummaries(payload.id, { archived });
      return res.status(200).json({ success: true, conversations: summaries });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  if (req.method === 'POST') {
    const targetId = Number(req.body?.userId);
    if (!Number.isInteger(targetId) || targetId === payload.id) {
      return res.status(422).json({ success: false, message: 'Requete invalide' });
    }

    try {
      const targetRows = await query('SELECT id FROM user WHERE id = ? LIMIT 1', [targetId]);
      if (targetRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
      }

      const { blockedByMe, blockingMe } = await getBlockStatus(payload.id, targetId);
      if (blockedByMe || blockingMe) {
        return res.status(403).json({ success: false, message: 'Action impossible' });
      }

      const friendRow = await getFriendRow(payload.id, targetId);
      if (!friendRow || friendRow.status !== 'accepted') {
        return res.status(403).json({ success: false, message: 'Vous devez etre amis pour discuter' });
      }

      const conversationId = await getOrCreateDirectConversation(payload.id, targetId);
      const participants = await getOtherParticipants(conversationId, payload.id);

      return res.status(200).json({ success: true, conversation: { id: conversationId, participants } });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ success: false, message: 'Methode non autorisee' });
}
