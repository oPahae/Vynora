import { getUserFromRequest } from '@/lib/auth';
import { isParticipant, getOtherParticipants, clearConversationForUser, setConversationArchived } from '@/lib/conversations';

export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const conversationId = Number(req.query.id);
  if (!Number.isInteger(conversationId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  const allowed = await isParticipant(conversationId, payload.id);
  if (!allowed) {
    return res.status(403).json({ success: false, message: 'Action non autorisee' });
  }

  if (req.method === 'GET') {
    try {
      const participants = await getOtherParticipants(conversationId, payload.id);
      return res.status(200).json({ success: true, conversation: { id: conversationId, participants } });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await clearConversationForUser(conversationId, payload.id);
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const archived = Boolean(req.body?.archived);
      await setConversationArchived(conversationId, payload.id, archived);
      return res.status(200).json({ success: true, archived });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  res.setHeader('Allow', ['GET', 'DELETE', 'PATCH']);
  return res.status(405).json({ success: false, message: 'Methode non autorisee' });
}
