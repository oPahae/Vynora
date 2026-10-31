import { query } from './db';
import { getBlockStatus, getFriendRow } from './friends';
import { STATUS_PRESETS, STATUS_DURATIONS, computeExpiresAt } from './statusConstants';

export { STATUS_PRESETS, STATUS_DURATIONS, computeExpiresAt };

function formatStatusRow(row) {
  if (!row) return null;
  if (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) return null;
  return {
    emoji: row.emoji,
    label: row.label,
    expiresAt: row.expiresAt
  };
}

export async function getPresenceStatus(userId) {
  const rows = await query('SELECT emoji, label, expiresAt FROM presenceStatus WHERE userId = ? LIMIT 1', [
    userId
  ]);
  return formatStatusRow(rows[0]);
}

// Recupere les statuts de plusieurs utilisateurs en une seule requete
// (listes d'amis, participants de conversation, etc.).
export async function getPresenceStatusBatch(userIds) {
  const result = {};
  if (!userIds || userIds.length === 0) return result;
  const uniqueIds = [...new Set(userIds)];
  const placeholders = uniqueIds.map(() => '?').join(', ');
  const rows = await query(
    `SELECT userId, emoji, label, expiresAt FROM presenceStatus WHERE userId IN (${placeholders})`,
    uniqueIds
  );
  rows.forEach((row) => {
    const formatted = formatStatusRow(row);
    if (formatted) result[row.userId] = formatted;
  });
  return result;
}

export async function setPresenceStatus(userId, { emoji, label, expiresAt }) {
  await query(
    `INSERT INTO presenceStatus (userId, emoji, label, expiresAt) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE emoji = VALUES(emoji), label = VALUES(label), expiresAt = VALUES(expiresAt)`,
    [userId, emoji || null, label, expiresAt]
  );
  return getPresenceStatus(userId);
}

export async function clearPresenceStatus(userId) {
  await query('DELETE FROM presenceStatus WHERE userId = ?', [userId]);
}

// Le statut personnalise suit les memes regles de confidentialite que le
// profil : bloque => invisible, profil prive => reserve aux amis.
export async function canViewPresenceStatus(viewerId, targetId) {
  if (viewerId === targetId) return true;

  const { blockedByMe, blockingMe } = await getBlockStatus(viewerId, targetId);
  if (blockedByMe || blockingMe) return false;

  const rows = await query('SELECT isPrivate FROM user WHERE id = ? LIMIT 1', [targetId]);
  if (!rows[0] || !rows[0].isPrivate) return true;

  const friendRow = await getFriendRow(viewerId, targetId);
  return Boolean(friendRow && friendRow.status === 'accepted');
}
