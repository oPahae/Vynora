import { getUserFromRequest } from '@/lib/auth';
import { logActivity, snippet } from '@/lib/activity';
import { query } from '@/lib/db';

export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const targetId = Number(req.query.userId);
  if (!Number.isInteger(targetId) || targetId === payload.id) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  if (req.method === 'POST') {
    try {
      await query(
        'DELETE FROM friend WHERE (requesterId = ? AND addresseeId = ?) OR (requesterId = ? AND addresseeId = ?)',
        [payload.id, targetId, targetId, payload.id]
      );
      await query('INSERT IGNORE INTO block (blockerId, blockedId) VALUES (?, ?)', [payload.id, targetId]);

      if (global.io) {
        global.io.to(`user:${targetId}`).emit('block:changed', { byUserId: payload.id, blocked: true });
        global.io.to(`user:${payload.id}`).emit('block:changed', { byUserId: targetId, blocked: true, self: true });
      }

      await logActivity(payload.id, 'user_block', { targetType: 'user', targetId, meta: { userId: targetId } });
      return res.status(200).json({ success: true, blocked: true });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await query('DELETE FROM block WHERE blockerId = ? AND blockedId = ?', [payload.id, targetId]);

      if (global.io) {
        global.io.to(`user:${targetId}`).emit('block:changed', { byUserId: payload.id, blocked: false });
        global.io.to(`user:${payload.id}`).emit('block:changed', { byUserId: targetId, blocked: false, self: true });
      }

      await logActivity(payload.id, 'user_unblock', { targetType: 'user', targetId, meta: { userId: targetId } });
      return res.status(200).json({ success: true, blocked: false });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  res.setHeader('Allow', ['POST', 'DELETE']);
  return res.status(405).json({ success: false, message: 'Methode non autorisee' });
}
