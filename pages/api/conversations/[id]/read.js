import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { isParticipant } from '@/lib/conversations';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

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

  try {
    const unseenRows = await query(
      `SELECT m.id FROM message m
       WHERE m.conversationId = ? AND m.senderId != ?
         AND NOT EXISTS (SELECT 1 FROM messageSeen ms WHERE ms.messageId = m.id AND ms.userId = ?)`,
      [conversationId, payload.id, payload.id]
    );

    if (unseenRows.length > 0) {
      const values = unseenRows.map((row) => [row.id, payload.id]);
      await query(
        `INSERT IGNORE INTO messageSeen (messageId, userId) VALUES ${values.map(() => '(?, ?)').join(', ')}`,
        values.flat()
      );
    }

    const lastMessageRows = await query(
      'SELECT MAX(id) as maxId FROM message WHERE conversationId = ?',
      [conversationId]
    );
    const maxId = lastMessageRows[0]?.maxId;

    if (maxId) {
      await query(
        'UPDATE conversationParticipant SET lastReadMessageId = ? WHERE conversationId = ? AND userId = ?',
        [maxId, conversationId, payload.id]
      );
    }

    if (global.io && unseenRows.length > 0) {
      // On ne diffuse l'accuse de lecture que si le lecteur a lui-meme
      // active cette option (reglage symetrique, voir privacySettings).
      const readerRows = await query('SELECT showReadReceipts FROM user WHERE id = ? LIMIT 1', [payload.id]);
      const readerShowsReceipts = readerRows[0] ? Boolean(readerRows[0].showReadReceipts) : true;

      if (readerShowsReceipts) {
        global.io.to(`conversation:${conversationId}`).emit('message:seen', {
          conversationId,
          userId: payload.id,
          messageIds: unseenRows.map((row) => row.id)
        });
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
