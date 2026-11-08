import { query } from './db';
import { mediaUrl } from './upload';
import { getOrCreateDirectConversation, hydrateMessages, MESSAGE_SELECT } from './conversations';
import { getBlockStatus, getFriendRow } from './friends';

// Envoi d'un message prive "automatique" (reponse a une story, partage d'un
// reel...) : memes regles que la messagerie classique (amis uniquement, pas
// de blocage), meme diffusion temps reel.
//   -> { success: true, message, conversationId } | { success: false, status, message }
export async function sendDirectMessage({ senderId, targetUserId, content = null, type = 'text', reelId = null, storyId = null }) {
  if (!Number.isInteger(targetUserId) || targetUserId === senderId) {
    return { success: false, status: 422, message: 'Requete invalide' };
  }

  const targetRows = await query('SELECT id FROM user WHERE id = ? AND bannedAt IS NULL LIMIT 1', [targetUserId]);
  if (targetRows.length === 0) return { success: false, status: 404, message: 'Utilisateur introuvable' };

  const { blockedByMe, blockingMe } = await getBlockStatus(senderId, targetUserId);
  if (blockedByMe || blockingMe) {
    return { success: false, status: 403, message: 'Vous ne pouvez pas envoyer de message a cet utilisateur' };
  }

  const friendRow = await getFriendRow(senderId, targetUserId);
  if (!friendRow || friendRow.status !== 'accepted') {
    return { success: false, status: 403, message: 'Vous devez etre amis pour discuter' };
  }

  const conversationId = await getOrCreateDirectConversation(senderId, targetUserId);
  // Le destinataire a peut-etre masque la conversation : on la lui rouvre.
  await query('UPDATE conversationParticipant SET leftAt = NULL, archivedAt = NULL WHERE conversationId = ? AND userId = ?', [
    conversationId,
    targetUserId
  ]);

  const result = await query(
    'INSERT INTO message (conversationId, senderId, content, type, reelId, storyId) VALUES (?, ?, ?, ?, ?, ?)',
    [conversationId, senderId, content || null, type, reelId, storyId]
  );
  const messageId = result.insertId;

  await query('INSERT IGNORE INTO messageSeen (messageId, userId) VALUES (?, ?)', [messageId, senderId]);
  await query('UPDATE conversationParticipant SET lastReadMessageId = ? WHERE conversationId = ? AND userId = ?', [
    messageId,
    conversationId,
    senderId
  ]);
  await query('UPDATE conversation SET updatedAt = NOW() WHERE id = ?', [conversationId]);

  const rows = await query(`${MESSAGE_SELECT} WHERE m.id = ? LIMIT 1`, [messageId]);
  const [message] = await hydrateMessages(rows, senderId);

  if (global.io) {
    global.io.to(`conversation:${conversationId}`).emit('message:new', message);

    const senderRows = await query('SELECT firstName, lastName, avatarId FROM user WHERE id = ? LIMIT 1', [senderId]);
    const sender = senderRows[0];
    global.io.to(`user:${targetUserId}`).emit('conversation:updated', {
      conversationId,
      messageId: message.id,
      senderId,
      senderName: sender ? `${sender.firstName} ${sender.lastName}` : null,
      senderAvatar: mediaUrl(sender?.avatarId),
      type: message.type,
      content: message.content
    });
  }

  return { success: true, message, conversationId };
}
