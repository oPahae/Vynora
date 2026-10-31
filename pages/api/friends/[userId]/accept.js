import { getUserFromRequest } from '@/lib/auth';
import { logActivity, snippet } from '@/lib/activity';
import { query } from '@/lib/db';
import { createNotification } from '@/lib/notifications';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const targetId = Number(req.query.userId);
  if (!Number.isInteger(targetId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  try {
    const result = await query(
      "UPDATE friend SET status = 'accepted', updatedAt = NOW() WHERE requesterId = ? AND addresseeId = ? AND status = 'pending'",
      [targetId, payload.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Invitation introuvable' });
    }

    await createNotification({ userId: targetId, actorId: payload.id, type: 'friendAccept', targetType: 'user', targetId: payload.id });
    await logActivity(payload.id, 'friend_request_accepted', { targetType: 'user', targetId, meta: { userId: targetId } });
    await logActivity(targetId, 'friend_request_received_accepted', { targetType: 'user', targetId: payload.id, meta: { userId: payload.id } });

    return res.status(200).json({ success: true, status: 'friends' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
