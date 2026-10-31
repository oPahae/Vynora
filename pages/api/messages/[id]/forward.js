import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { isParticipant, hydrateMessages, MESSAGE_SELECT, getOrCreateDirectConversation } from '@/lib/conversations';
import { getBlockStatus } from '@/lib/friends';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const messageId = Number(req.query.id);
  if (!Number.isInteger(messageId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  const targetUserIds = Array.isArray(req.body?.targetUserIds)
    ? req.body.targetUserIds.map(Number).filter(Number.isInteger)
    : [];

  if (targetUserIds.length === 0) {
    return res.status(422).json({ success: false, message: 'Choisissez au moins un destinataire' });
  }

  const sourceRows = await query('SELECT * FROM message WHERE id = ? LIMIT 1', [messageId]);
  const source = sourceRows[0];
  if (!source || source.deletedForEveryone) {
    return res.status(404).json({ success: false, message: 'Message introuvable' });
  }

  const allowed = await isParticipant(source.conversationId, payload.id);
  if (!allowed) {
    return res.status(403).json({ success: false, message: 'Action non autorisee' });
  }

  try {
    const forwarded = [];

    for (const targetUserId of targetUserIds) {
      // eslint-disable-next-line no-await-in-loop
      const { blockedByMe, blockingMe } = await getBlockStatus(payload.id, targetUserId);
      if (blockedByMe || blockingMe) continue;

      // eslint-disable-next-line no-await-in-loop
      const conversationId = await getOrCreateDirectConversation(payload.id, targetUserId);

      // eslint-disable-next-line no-await-in-loop
      const result = await query(
        'INSERT INTO message (conversationId, senderId, content, type, mediaId, fileName) VALUES (?, ?, ?, ?, ?, ?)',
        [conversationId, payload.id, source.content, source.type, source.mediaId, source.fileName]
      );
      const newMessageId = result.insertId;

      // eslint-disable-next-line no-await-in-loop
      await query('INSERT IGNORE INTO messageSeen (messageId, userId) VALUES (?, ?)', [newMessageId, payload.id]);
      // eslint-disable-next-line no-await-in-loop
      await query('UPDATE conversationParticipant SET lastReadMessageId = ? WHERE conversationId = ? AND userId = ?', [
        newMessageId,
        conversationId,
        payload.id
      ]);
      // eslint-disable-next-line no-await-in-loop
      await query('UPDATE conversation SET updatedAt = NOW() WHERE id = ?', [conversationId]);

      // eslint-disable-next-line no-await-in-loop
      const rows = await query(`${MESSAGE_SELECT} WHERE m.id = ? LIMIT 1`, [newMessageId]);
      // eslint-disable-next-line no-await-in-loop
      const [message] = await hydrateMessages(rows, payload.id);
      forwarded.push(message);

      if (global.io) {
        global.io.to(`conversation:${conversationId}`).emit('message:new', message);
        global.io.to(`user:${targetUserId}`).emit('conversation:updated', {
          conversationId,
          messageId: message.id,
          senderId: payload.id,
          type: message.type,
          content: message.content
        });
      }
    }

    if (forwarded.length === 0) {
      return res.status(422).json({ success: false, message: "Le message n'a pu etre transfere a aucun destinataire" });
    }

    return res.status(201).json({ success: true, messages: forwarded });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur lors du transfert' });
  }
}
