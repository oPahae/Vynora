import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { isParticipant } from '@/lib/conversations';

export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const messageId = Number(req.query.id);
  if (!Number.isInteger(messageId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  const messageRows = await query('SELECT conversationId FROM message WHERE id = ? LIMIT 1', [messageId]);
  const message = messageRows[0];
  if (!message) {
    return res.status(404).json({ success: false, message: 'Message introuvable' });
  }

  const allowed = await isParticipant(message.conversationId, payload.id);
  if (!allowed) {
    return res.status(403).json({ success: false, message: 'Action non autorisee' });
  }

  if (req.method === 'PUT') {
    await query('INSERT IGNORE INTO messageFavorite (messageId, userId) VALUES (?, ?)', [messageId, payload.id]);
    return res.status(200).json({ success: true, isFavorite: true });
  }

  if (req.method === 'DELETE') {
    await query('DELETE FROM messageFavorite WHERE messageId = ? AND userId = ?', [messageId, payload.id]);
    return res.status(200).json({ success: true, isFavorite: false });
  }

  res.setHeader('Allow', ['PUT', 'DELETE']);
  return res.status(405).json({ success: false, message: 'Methode non autorisee' });
}
