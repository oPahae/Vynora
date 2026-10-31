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

  const rows = await query('SELECT * FROM message WHERE id = ? LIMIT 1', [messageId]);
  if (rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Message introuvable' });
  }

  const message = rows[0];
  const allowed = await isParticipant(message.conversationId, payload.id);
  if (!allowed) {
    return res.status(403).json({ success: false, message: 'Action non autorisee' });
  }

  if (req.method === 'PUT') {
    if (message.senderId !== payload.id) {
      return res.status(403).json({ success: false, message: 'Action non autorisee' });
    }
    if (message.type !== 'text') {
      return res.status(422).json({ success: false, message: 'Seuls les messages texte peuvent etre modifies' });
    }

    const content = (req.body?.content || '').toString().trim();
    if (!content) {
      return res.status(422).json({ success: false, message: 'Le message ne peut pas etre vide' });
    }

    try {
      await query('UPDATE message SET content = ?, isEdited = 1, updatedAt = NOW() WHERE id = ?', [
        content,
        messageId
      ]);

      const updatedRows = await query('SELECT * FROM message WHERE id = ? LIMIT 1', [messageId]);
      const updated = updatedRows[0];

      if (global.io) {
        global.io.to(`conversation:${message.conversationId}`).emit('message:updated', {
          id: updated.id,
          conversationId: updated.conversationId,
          content: updated.content,
          isEdited: true
        });
      }

      return res.status(200).json({ success: true, message: updated });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  if (req.method === 'DELETE') {
    const scope = (req.query.scope || 'me').toString();

    try {
      if (scope === 'everyone') {
        if (message.senderId !== payload.id) {
          return res.status(403).json({ success: false, message: 'Action non autorisee' });
        }
        await query('UPDATE message SET deletedForEveryone = 1, content = NULL, mediaId = NULL WHERE id = ?', [
          messageId
        ]);

        if (global.io) {
          global.io.to(`conversation:${message.conversationId}`).emit('message:deleted', {
            id: messageId,
            conversationId: message.conversationId,
            scope: 'everyone'
          });
        }
      } else {
        await query('INSERT IGNORE INTO messageDeletion (messageId, userId) VALUES (?, ?)', [messageId, payload.id]);

        if (global.io) {
          global.io.to(`user:${payload.id}`).emit('message:deleted', {
            id: messageId,
            conversationId: message.conversationId,
            scope: 'me'
          });
        }
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  res.setHeader('Allow', ['PUT', 'DELETE']);
  return res.status(405).json({ success: false, message: 'Methode non autorisee' });
}
