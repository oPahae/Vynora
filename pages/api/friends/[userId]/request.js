import { getUserFromRequest } from '@/lib/auth';
import { logActivity, snippet } from '@/lib/activity';
import { query } from '@/lib/db';
import { getFriendRow, getBlockStatus } from '@/lib/friends';
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

    const existing = await getFriendRow(payload.id, targetId);

    if (existing && existing.status === 'accepted') {
      return res.status(200).json({ success: true, status: 'friends' });
    }

    if (existing && existing.status === 'pending' && existing.requesterId === payload.id) {
      return res.status(200).json({ success: true, status: 'requestSent' });
    }

    if (existing && existing.status === 'pending' && existing.requesterId === targetId) {
      await query("UPDATE friend SET status = 'accepted', updatedAt = NOW() WHERE id = ?", [existing.id]);
      await createNotification({ userId: targetId, actorId: payload.id, type: 'friendAccept', targetType: 'user', targetId: payload.id });
      await logActivity(payload.id, 'friend_request_accepted', { targetType: 'user', targetId, meta: { userId: targetId } });
      await logActivity(targetId, 'friend_request_received_accepted', { targetType: 'user', targetId: payload.id, meta: { userId: payload.id } });
      return res.status(200).json({ success: true, status: 'friends' });
    }

    await query('INSERT INTO friend (requesterId, addresseeId, status) VALUES (?, ?, ?)', [
      payload.id,
      targetId,
      'pending'
    ]);
    await createNotification({ userId: targetId, actorId: payload.id, type: 'friendRequest', targetType: 'user', targetId: payload.id });
    await logActivity(payload.id, 'friend_request_sent', { targetType: 'user', targetId, meta: { userId: targetId } });

    return res.status(200).json({ success: true, status: 'requestSent' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
