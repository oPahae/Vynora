import { query } from './db';
import { snippet } from './activity';

export const REPORT_REASONS = [
  'spam',
  'harassment',
  'hate',
  'violence',
  'nudity',
  'misinformation',
  'scam',
  'impersonation',
  'other'
];

export const REPORT_TARGETS = ['user', 'post', 'comment', 'reel', 'reelComment', 'group'];

// Retrouve la cible d'un signalement : existence, auteur (pour pouvoir
// bannir le compte concerne) et un extrait du contenu (conserve dans le
// signalement meme si le contenu est supprime ensuite).
export async function resolveReportTarget(targetType, targetId) {
  switch (targetType) {
    case 'user': {
      const rows = await query('SELECT id, firstName, lastName FROM user WHERE id = ? AND bannedAt IS NULL LIMIT 1', [targetId]);
      if (!rows[0]) return null;
      return { ownerId: rows[0].id, snapshot: `${rows[0].firstName} ${rows[0].lastName}` };
    }
    case 'post': {
      const rows = await query('SELECT userId, content FROM post WHERE id = ? AND deletedAt IS NULL LIMIT 1', [targetId]);
      if (!rows[0]) return null;
      return { ownerId: rows[0].userId, snapshot: snippet(rows[0].content, 300) || '[media]' };
    }
    case 'comment': {
      const rows = await query('SELECT userId, content FROM comment WHERE id = ? AND deletedAt IS NULL LIMIT 1', [targetId]);
      if (!rows[0]) return null;
      return { ownerId: rows[0].userId, snapshot: snippet(rows[0].content, 300) || '[media]' };
    }
    case 'reel': {
      const rows = await query('SELECT userId, caption FROM reel WHERE id = ? AND deletedAt IS NULL LIMIT 1', [targetId]);
      if (!rows[0]) return null;
      return { ownerId: rows[0].userId, snapshot: snippet(rows[0].caption, 300) || '[reel]' };
    }
    case 'reelComment': {
      const rows = await query('SELECT userId, content FROM reelComment WHERE id = ? AND deletedAt IS NULL LIMIT 1', [targetId]);
      if (!rows[0]) return null;
      return { ownerId: rows[0].userId, snapshot: snippet(rows[0].content, 300) };
    }
    case 'group': {
      const rows = await query('SELECT ownerId, name FROM communityGroup WHERE id = ? LIMIT 1', [targetId]);
      if (!rows[0]) return null;
      return { ownerId: rows[0].ownerId, snapshot: rows[0].name };
    }
    default:
      return null;
  }
}

export async function createReport(reporterId, { targetType, targetId, reason, details }) {
  if (!REPORT_TARGETS.includes(targetType)) return { success: false, status: 422, message: 'Type de signalement invalide' };
  if (!REPORT_REASONS.includes(reason)) return { success: false, status: 422, message: 'Motif invalide' };
  if (!Number.isInteger(targetId)) return { success: false, status: 422, message: 'Requete invalide' };

  const target = await resolveReportTarget(targetType, targetId);
  if (!target) return { success: false, status: 404, message: 'Contenu introuvable' };
  if (target.ownerId === reporterId) {
    return { success: false, status: 422, message: 'Vous ne pouvez pas signaler votre propre contenu' };
  }

  const cleanDetails = (details || '').toString().trim().slice(0, 500) || null;

  const result = await query(
    `INSERT IGNORE INTO report (reporterId, targetType, targetId, targetUserId, reason, details, snapshot)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [reporterId, targetType, targetId, target.ownerId, reason, cleanDetails, target.snapshot]
  );

  if (result.affectedRows === 0) {
    return { success: false, status: 409, message: 'Vous avez deja signale ce contenu' };
  }

  // Previent les administrateurs connectes en temps reel (badge dans l'admin).
  if (global.io) {
    const admins = await query("SELECT id FROM user WHERE role = 'admin' AND bannedAt IS NULL");
    admins.forEach((admin) => global.io.to(`user:${admin.id}`).emit('admin:report', { reportId: result.insertId }));
  }

  return { success: true, reportId: result.insertId };
}
