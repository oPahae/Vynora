import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { parseUpload, getField, saveMediaFile, mediaUrl } from '@/lib/upload';
import { isParticipant, hydrateMessages, MESSAGE_SELECT, getClearedAt } from '@/lib/conversations';
import { getBlockStatus } from '@/lib/friends';

export const config = {
  api: {
    bodyParser: false
  }
};

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/webm',
  'audio/ogg',
  'audio/wav',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'text/plain'
];

function messageTypeFromMime(mimetype) {
  if (mimetype.startsWith('image')) return 'image';
  if (mimetype.startsWith('video')) return 'video';
  if (mimetype.startsWith('audio')) return 'audio';
  return 'file';
}

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
      const offset = Number(req.query.offset) || 0;
      const limit = Math.min(Number(req.query.limit) || 20, 50);
      const clearedAt = await getClearedAt(conversationId, payload.id);

      const rows = await query(
        `${MESSAGE_SELECT}
         WHERE m.conversationId = ?
           AND NOT EXISTS (SELECT 1 FROM messageDeletion md WHERE md.messageId = m.id AND md.userId = ?)
           ${clearedAt ? 'AND m.createdAt > ?' : ''}
         ORDER BY m.createdAt DESC
         LIMIT ? OFFSET ?`,
        clearedAt
          ? [conversationId, payload.id, clearedAt, limit + 1, offset]
          : [conversationId, payload.id, limit + 1, offset]
      );

      const hasMore = rows.length > limit;
      const pageRows = rows.slice(0, limit).reverse();
      const messages = await hydrateMessages(pageRows, payload.id);

      return res.status(200).json({ success: true, messages, hasMore });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  if (req.method === 'POST') {
    try {
      const otherParticipantsCheck = await query(
        'SELECT userId FROM conversationParticipant WHERE conversationId = ? AND userId != ?',
        [conversationId, payload.id]
      );
      for (const participant of otherParticipantsCheck) {
        const { blockedByMe, blockingMe } = await getBlockStatus(payload.id, participant.userId);
        if (blockedByMe || blockingMe) {
          return res.status(403).json({ success: false, message: 'Vous ne pouvez pas envoyer de message a cet utilisateur' });
        }
      }

      const { fields, files } = await parseUpload(req, ALLOWED_TYPES);

      const content = getField(fields, 'content').toString().trim();
      const replyToIdRaw = getField(fields, 'replyToId', '');
      const replyToId = replyToIdRaw ? Number(replyToIdRaw) : null;

      if (!content && files.length === 0) {
        return res.status(422).json({ success: false, message: 'Le message ne peut pas etre vide' });
      }

      const type = files.length > 0 ? messageTypeFromMime(files[0].mimetype) : 'text';
      const mediaId = files.length > 0 ? await saveMediaFile(files[0], payload.id) : null;
      const fileName = files.length > 0 ? files[0].originalFilename : null;

      const result = await query(
        'INSERT INTO message (conversationId, senderId, content, type, mediaId, fileName, replyToId) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [conversationId, payload.id, content || null, type, mediaId, fileName, replyToId]
      );

      const messageId = result.insertId;

      await query('INSERT IGNORE INTO messageSeen (messageId, userId) VALUES (?, ?)', [messageId, payload.id]);
      await query('UPDATE conversationParticipant SET lastReadMessageId = ? WHERE conversationId = ? AND userId = ?', [
        messageId,
        conversationId,
        payload.id
      ]);
      await query('UPDATE conversation SET updatedAt = NOW() WHERE id = ?', [conversationId]);

      const rows = await query(`${MESSAGE_SELECT} WHERE m.id = ? LIMIT 1`, [messageId]);
      const [message] = await hydrateMessages(rows, payload.id);

      const otherParticipants = await query(
        'SELECT userId FROM conversationParticipant WHERE conversationId = ? AND userId != ? AND leftAt IS NULL',
        [conversationId, payload.id]
      );

      // Note: new messages intentionally do not create entries in the
      // notification table (and therefore never show up in the alerts/bell
      // dropdown). Unread messages are tracked separately via
      // conversationParticipant.lastReadMessageId and surfaced through the
      // dedicated messages badge instead.

      if (global.io) {
        global.io.to(`conversation:${conversationId}`).emit('message:new', message);

        const senderRows = await query('SELECT firstName, lastName, avatarId FROM user WHERE id = ? LIMIT 1', [
          payload.id
        ]);
        const sender = senderRows[0];
        const preview = {
          conversationId,
          messageId: message.id,
          senderId: payload.id,
          senderName: sender ? `${sender.firstName} ${sender.lastName}` : null,
          senderAvatar: mediaUrl(sender?.avatarId),
          type: message.type,
          content: message.content
        };

        otherParticipants.forEach((participant) => {
          global.io.to(`user:${participant.userId}`).emit('conversation:updated', preview);
        });
      }

      return res.status(201).json({ success: true, message });
    } catch (error) {
      return res.status(422).json({ success: false, message: error.message || 'Erreur lors de l\'envoi' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ success: false, message: 'Methode non autorisee' });
}
