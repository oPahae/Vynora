import { getUserFromRequest } from '@/lib/auth';
import { logActivity, snippet } from '@/lib/activity';
import { query } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
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
    await query(
      "DELETE FROM friend WHERE status = 'accepted' AND ((requesterId = ? AND addresseeId = ?) OR (requesterId = ? AND addresseeId = ?))",
      [payload.id, targetId, targetId, payload.id]
    );
    await logActivity(payload.id, 'friend_removed', { targetType: 'user', targetId, meta: { userId: targetId } });
    return res.status(200).json({ success: true, status: 'none' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
