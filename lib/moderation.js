import { query } from './db';
import { invalidateUserStatus } from './auth';
import { deleteGuild } from './guilds';
import { createNotification } from './notifications';
import { approvePendingAppealsOnUnban } from './appeals';
import { grantPremium, revokePremium } from './premium';

// Actions de moderation partagees par le panneau d'administration et le
// traitement des signalements. Chaque action est tracee dans `adminAudit`.

export async function audit(adminId, action, targetType = null, targetId = null, details = null) {
  try {
    await query('INSERT INTO adminAudit (adminId, action, targetType, targetId, details) VALUES (?, ?, ?, ?, ?)', [
      adminId,
      action,
      targetType,
      targetId,
      details ? String(details).slice(0, 500) : null
    ]);
  } catch (error) {
    // le journal d'audit ne doit pas bloquer l'action
  }
}

// Un motif est obligatoire pour toute sanction. Limite a 180 caracteres pour
// tenir dans la colonne `notification.content` (JSON compris).
export function cleanReason(reason) {
  const value = (reason || '').toString().replace(/\s+/g, ' ').trim().slice(0, 180);
  return value || null;
}

// Deconnecte en temps reel toutes les sessions d'un utilisateur : on previent
// d'abord ses onglets (ils se deconnectent et affichent le motif), puis on
// coupe les sockets restants.
export function terminateSessions(userId, { kind, reason }) {
  if (global.io) global.io.to(`user:${userId}`).emit('account:terminated', { kind, reason });
  setTimeout(() => {
    if (global.disconnectUserSockets) global.disconnectUserSockets(userId);
  }, 600);
}

async function getContentOwner(targetType, targetId) {
  const queries = {
    post: 'SELECT userId AS owner FROM post WHERE id = ?',
    comment: 'SELECT userId AS owner FROM comment WHERE id = ?',
    reel: 'SELECT userId AS owner FROM reel WHERE id = ?',
    reelComment: 'SELECT userId AS owner FROM reelComment WHERE id = ?',
    group: 'SELECT ownerId AS owner FROM communityGroup WHERE id = ?',
    story: 'SELECT userId AS owner FROM status WHERE id = ?',
    server: 'SELECT ownerId AS owner FROM guild WHERE id = ?'
  };
  if (!queries[targetType]) return null;
  const rows = await query(queries[targetType], [targetId]);
  return rows[0] ? rows[0].owner : null;
}

export const DELETABLE_TYPES = ['post', 'comment', 'reel', 'reelComment', 'group', 'server', 'story', 'user'];

// Supprime un contenu. Les contenus "souples" (posts, commentaires, reels)
// sont marques `deletedAt` comme pour une suppression par leur auteur.
export async function deleteContent(adminId, targetType, targetId, rawReason = null) {
  const reason = cleanReason(rawReason);
  if (!reason) return { success: false, message: 'Un motif est requis' };
  const ownerId = await getContentOwner(targetType, targetId);
  let affected = 0;
  switch (targetType) {
    case 'post':
      affected = (await query('UPDATE post SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL', [targetId])).affectedRows;
      break;
    case 'comment':
      affected = (await query('UPDATE comment SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL', [targetId])).affectedRows;
      break;
    case 'reel':
      affected = (await query('UPDATE reel SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL', [targetId])).affectedRows;
      break;
    case 'reelComment':
      affected = (await query('UPDATE reelComment SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL', [targetId])).affectedRows;
      break;
    case 'group':
      affected = (await query('DELETE FROM communityGroup WHERE id = ?', [targetId])).affectedRows;
      break;
    case 'story':
      affected = (await query('DELETE FROM status WHERE id = ?', [targetId])).affectedRows;
      break;
    case 'server': {
      const rows = await query('SELECT id FROM guild WHERE id = ? LIMIT 1', [targetId]);
      if (rows[0]) {
        await deleteGuild(targetId);
        affected = 1;
      }
      break;
    }
    default:
      return { success: false, message: 'Type de contenu non supporte' };
  }

  if (affected === 0) return { success: false, message: 'Contenu introuvable ou deja supprime' };
  await audit(adminId, 'delete_content', targetType, targetId, reason);

  // Prevenir l'auteur, avec le motif. L'identite de l'administrateur n'est
  // jamais montree (l'interface affiche "Administration").
  if (ownerId && ownerId !== adminId) {
    try {
      await createNotification({
        userId: ownerId,
        actorId: adminId,
        type: 'moderation',
        content: JSON.stringify({ k: targetType, r: reason })
      });
    } catch (error) {
      // la suppression a reussi, la notification est un plus
    }
  }
  return { success: true };
}

async function isLastAdmin(userId) {
  const rows = await query("SELECT COUNT(*) AS count FROM user WHERE role = 'admin' AND bannedAt IS NULL AND id <> ?", [userId]);
  return Number(rows[0].count) === 0;
}

// Supprime (de facon definitive) le contenu d'un utilisateur banni.
async function purgeUserContent(userId) {
  await query('UPDATE post SET deletedAt = NOW() WHERE userId = ? AND deletedAt IS NULL', [userId]);
  await query('UPDATE comment SET deletedAt = NOW() WHERE userId = ? AND deletedAt IS NULL', [userId]);
  await query('UPDATE reel SET deletedAt = NOW() WHERE userId = ? AND deletedAt IS NULL', [userId]);
  await query('UPDATE reelComment SET deletedAt = NOW() WHERE userId = ? AND deletedAt IS NULL', [userId]);
  await query('DELETE FROM status WHERE userId = ?', [userId]);
}

export async function banUser(adminId, userId, { reason = null, purge = false, source = null } = {}) {
  const cleanBanReason = cleanReason(reason);
  if (!cleanBanReason) return { success: false, message: 'Un motif est requis' };
  if (adminId === userId) return { success: false, message: 'Vous ne pouvez pas vous bannir vous-meme' };
  const rows = await query('SELECT id, role, bannedAt FROM user WHERE id = ? LIMIT 1', [userId]);
  if (!rows[0]) return { success: false, message: 'Utilisateur introuvable' };
  if (rows[0].role === 'admin') {
    return { success: false, message: "Retirez d'abord le role administrateur avant de bannir ce compte" };
  }
  if (rows[0].bannedAt) return { success: false, message: 'Ce compte est deja banni' };

  await query('UPDATE user SET bannedAt = NOW(), banReason = ? WHERE id = ?', [cleanBanReason, userId]);
  // Historique du bannissement : motif, administrateur et contenu a l'origine
  // (publication, reel, commentaire...), consultables lors d'une demande de revision.
  await query(
    'INSERT INTO banRecord (userId, reason, adminId, sourceType, sourceId, sourceSnapshot) VALUES (?, ?, ?, ?, ?, ?)',
    [
      userId,
      cleanBanReason,
      adminId,
      source ? source.type : null,
      source ? source.id : null,
      source && source.snapshot ? String(source.snapshot).slice(0, 400) : null
    ]
  );
  if (purge) await purgeUserContent(userId);

  // Les signalements en attente visant directement ce compte sont clotures.
  await query(
    "UPDATE report SET status = 'resolved', action = 'user_banned', resolvedBy = ?, resolvedAt = NOW() WHERE targetType = 'user' AND targetId = ? AND status = 'pending'",
    [adminId, userId]
  );

  invalidateUserStatus(userId);
  terminateSessions(userId, { kind: 'banned', reason: cleanBanReason });
  await audit(adminId, purge ? 'ban_user_purge' : 'ban_user', 'user', userId, cleanBanReason);
  return { success: true };
}

export async function unbanUser(adminId, userId) {
  const result = await query('UPDATE user SET bannedAt = NULL, banReason = NULL WHERE id = ? AND bannedAt IS NOT NULL', [userId]);
  if (result.affectedRows === 0) return { success: false, message: "Ce compte n'est pas banni" };
  invalidateUserStatus(userId);
  await approvePendingAppealsOnUnban(adminId, userId);
  await audit(adminId, 'unban_user', 'user', userId);
  return { success: true };
}

export async function setUserRole(adminId, userId, role) {
  if (!['user', 'admin'].includes(role)) return { success: false, message: 'Role invalide' };
  const rows = await query('SELECT id, role, bannedAt FROM user WHERE id = ? LIMIT 1', [userId]);
  if (!rows[0]) return { success: false, message: 'Utilisateur introuvable' };
  if (role === 'admin' && rows[0].bannedAt) return { success: false, message: 'Debannissez ce compte avant de le promouvoir' };
  if (role === 'user' && rows[0].role === 'admin' && (await isLastAdmin(userId))) {
    return { success: false, message: 'Impossible : il doit rester au moins un administrateur' };
  }
  await query('UPDATE user SET role = ? WHERE id = ?', [role, userId]);
  invalidateUserStatus(userId);
  await audit(adminId, role === 'admin' ? 'promote_admin' : 'demote_admin', 'user', userId);
  return { success: true };
}

// Premium accorde / retire manuellement (geste commercial, remboursement...).
export async function adminGrantPremium(adminId, userId, days) {
  const duration = Number(days);
  if (!Number.isInteger(duration) || duration < 0 || duration > 3650) return { success: false, message: 'Duree invalide' };
  const rows = await query('SELECT id FROM user WHERE id = ? LIMIT 1', [userId]);
  if (!rows[0]) return { success: false, message: 'Utilisateur introuvable' };
  await grantPremium(userId, duration);
  await audit(adminId, 'grant_premium', 'user', userId, duration === 0 ? 'a vie' : `${duration} jours`);
  return { success: true };
}

export async function adminRevokePremium(adminId, userId) {
  await revokePremium(userId);
  await audit(adminId, 'revoke_premium', 'user', userId);
  return { success: true };
}

export async function deleteUserAccount(adminId, userId, rawReason = null) {
  const reason = cleanReason(rawReason);
  if (!reason) return { success: false, message: 'Un motif est requis' };
  if (adminId === userId) return { success: false, message: 'Vous ne pouvez pas supprimer votre propre compte ici' };
  const rows = await query('SELECT id, role, email FROM user WHERE id = ? LIMIT 1', [userId]);
  if (!rows[0]) return { success: false, message: 'Utilisateur introuvable' };
  if (rows[0].role === 'admin') {
    return { success: false, message: "Retirez d'abord le role administrateur avant de supprimer ce compte" };
  }

  // Le motif est conserve pour etre affiche lors d'une prochaine tentative de connexion.
  await query(
    'INSERT INTO deletedAccount (email, reason) VALUES (?, ?) ON DUPLICATE KEY UPDATE reason = VALUES(reason), deletedAt = NOW()',
    [String(rows[0].email).toLowerCase(), reason]
  );
  await query('DELETE FROM user WHERE id = ?', [userId]);
  invalidateUserStatus(userId);
  // Deconnexion immediate de toutes ses sessions ouvertes.
  terminateSessions(userId, { kind: 'deleted', reason });
  await audit(adminId, 'delete_user', 'user', userId, `${rows[0].email} — ${reason}`);
  return { success: true };
}

// Traite un lot de signalements portant sur la meme cible.
//   action : dismiss | delete_content | ban_user | delete_and_ban
export async function resolveReports(adminId, targetType, targetId, action, { reason: rawReason = null, purge = false } = {}) {
  const ACTIONS = ['dismiss', 'delete_content', 'ban_user', 'delete_and_ban'];
  if (!ACTIONS.includes(action)) return { success: false, message: 'Action invalide' };
  const reason = cleanReason(rawReason);
  if (action !== 'dismiss' && !reason) return { success: false, message: 'Un motif est requis' };

  const pending = await query(
    "SELECT id, targetUserId, snapshot FROM report WHERE targetType = ? AND targetId = ? AND status = 'pending'",
    [targetType, targetId]
  );
  if (pending.length === 0) return { success: false, message: 'Aucun signalement en attente pour cette cible' };
  const ownerId = pending[0].targetUserId;

  const done = [];
  const warnings = [];

  if (action === 'delete_content' || action === 'delete_and_ban') {
    if (targetType === 'user') {
      warnings.push("Un compte n'est pas un contenu : utilisez le bannissement");
    } else {
      const result = await deleteContent(adminId, targetType, targetId, reason);
      if (result.success) done.push('content_deleted');
      else warnings.push(result.message);
    }
  }

  if (action === 'ban_user' || action === 'delete_and_ban') {
    const userToBan = targetType === 'user' ? targetId : ownerId;
    if (!userToBan) {
      warnings.push('Auteur introuvable');
    } else {
      // Contenu a l'origine du bannissement (rien pour un signalement visant le compte lui-meme).
      const source = targetType === 'user' ? null : { type: targetType, id: targetId, snapshot: pending[0].snapshot };
      const result = await banUser(adminId, userToBan, { reason, purge, source });
      if (result.success) done.push('user_banned');
      else warnings.push(result.message);
    }
  }

  if (action !== 'dismiss' && done.length === 0) {
    return { success: false, message: warnings[0] || "Aucune action n'a pu etre appliquee" };
  }

  const finalStatus = action === 'dismiss' ? 'dismissed' : 'resolved';
  const finalAction = action === 'dismiss' ? 'dismissed' : done.join('+');
  await query(
    `UPDATE report SET status = ?, action = ?, resolvedBy = ?, resolvedAt = NOW()
     WHERE targetType = ? AND targetId = ? AND status = 'pending'`,
    [finalStatus, finalAction, adminId, targetType, targetId]
  );
  await audit(adminId, `report_${finalStatus}`, targetType, targetId, finalAction);
  return { success: true, resolved: pending.length, applied: done, warnings };
}
