import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const notificationId = Number(req.query.id);
  if (!Number.isInteger(notificationId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  try {
    await query('UPDATE notification SET isRead = 1 WHERE id = ? AND userId = ?', [notificationId, payload.id]);
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
