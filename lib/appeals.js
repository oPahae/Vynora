import { query } from './db';
import { comparePassword, invalidateUserStatus } from './auth';
import { sendMail } from './mailer';
import { APP_NAME } from './constants';
import { tr } from './i18n/server';
import { mediaUrl } from './upload';
import { getTargetLiveState } from './admin';

const REAPPEAL_DELAY_DAYS = 7;

function cleanText(value, max) {
  return (value || '').toString().replace(/\r\n/g, '\n').trim().slice(0, max);
}

// Demande de revision d'un bannissement. L'utilisateur ne peut pas se connecter :
// il prouve son identite avec son email + mot de passe.
export async function submitAppeal({ email, password, message }) {
  const cleanMessage = cleanText(message, 1000);
  if (cleanMessage.length < 20) return { success: false, status: 422, message: 'Expliquez votre situation (20 caracteres minimum)' };

  const rows = await query('SELECT id, password, bannedAt FROM user WHERE email = ? LIMIT 1', [cleanText(email, 255).toLowerCase()]);
  const user = rows[0];
  // Meme reponse que pour un mauvais mot de passe : pas de fuite d'information.
  if (!user || !(await comparePassword(password || '', user.password))) {
    return { success: false, status: 401, message: 'Email ou mot de passe incorrect' };
  }
  if (!user.bannedAt) return { success: false, status: 422, message: "Ce compte n'est pas suspendu" };

  const pending = await query("SELECT id FROM banAppeal WHERE userId = ? AND status = 'pending' LIMIT 1", [user.id]);
  if (pending[0]) return { success: false, status: 409, message: 'Une demande de revision est deja en cours' };

  const recentRejected = await query(
    `SELECT id FROM banAppeal WHERE userId = ? AND status = 'rejected'
     AND reviewedAt > DATE_SUB(NOW(), INTERVAL ${REAPPEAL_DELAY_DAYS} DAY) LIMIT 1`,
    [user.id]
  );
  if (recentRejected[0]) {
    return { success: false, status: 429, message: `Votre derniere demande a ete refusee. Vous pourrez en faire une nouvelle dans ${REAPPEAL_DELAY_DAYS} jours maximum` };
  }

  await query('INSERT INTO banAppeal (userId, message) VALUES (?, ?)', [user.id, cleanMessage]);
  return { success: true };
}

export async function listAppeals(status = 'pending', offset = 0, limit = 20) {
  const safeStatus = ['pending', 'approved', 'rejected'].includes(status) ? status : 'pending';
  const rows = await query(
    `SELECT a.id, a.message, a.status, a.adminNote, a.createdAt, a.reviewedAt,
            u.id AS userId, u.firstName, u.lastName, u.email, u.avatarId, u.banReason, u.bannedAt
     FROM banAppeal a JOIN user u ON u.id = a.userId
     WHERE a.status = ? ORDER BY a.${safeStatus === 'pending' ? 'createdAt ASC' : 'reviewedAt DESC'}
     LIMIT ${limit + 1} OFFSET ${offset}`,
    [safeStatus]
  );
  const page = rows.slice(0, limit);

  const items = [];
  for (const row of page) {
    // Dernier bannissement enregistre avant la demande (motif d'origine + contenu a l'origine).
    // eslint-disable-next-line no-await-in-loop
    const records = await query(
      `SELECT b.id, b.reason, b.sourceType, b.sourceId, b.sourceSnapshot, b.createdAt, a2.firstName AS adminFirstName, a2.lastName AS adminLastName
       FROM banRecord b LEFT JOIN user a2 ON a2.id = b.adminId
       WHERE b.userId = ? AND b.createdAt <= ? ORDER BY b.id DESC LIMIT 1`,
      [row.userId, row.createdAt]
    );
    const record = records[0] || null;

    let source = null;
    if (record && record.sourceType) {
      // eslint-disable-next-line no-await-in-loop
      const live = await getTargetLiveState(record.sourceType, record.sourceId);
      source = { type: record.sourceType, id: record.sourceId, snapshot: record.sourceSnapshot, exists: live.exists, href: live.href };
    }

    // Signalements ayant vise ce compte ou son contenu (utile quand le ban a ete manuel).
    // eslint-disable-next-line no-await-in-loop
    const reports = await query(
      `SELECT targetType, targetId, reason, snapshot, createdAt FROM report
       WHERE targetUserId = ? ORDER BY id DESC LIMIT 3`,
      [row.userId]
    );
    const relatedReports = [];
    for (const report of reports) {
      // eslint-disable-next-line no-await-in-loop
      const live = await getTargetLiveState(report.targetType, report.targetId);
      relatedReports.push({ type: report.targetType, id: report.targetId, reason: report.reason, snapshot: report.snapshot, createdAt: report.createdAt, exists: live.exists, href: live.href });
    }

    items.push({
      id: row.id,
      message: row.message,
      status: row.status,
      adminNote: row.adminNote,
      createdAt: row.createdAt,
      reviewedAt: row.reviewedAt,
      ban: {
        reason: (record && record.reason) || row.banReason || null,
        at: record ? record.createdAt : row.bannedAt,
        by: record && record.adminFirstName ? `${record.adminFirstName} ${record.adminLastName}` : null,
        source
      },
      relatedReports,
      user: { id: row.userId, firstName: row.firstName, lastName: row.lastName, email: row.email, avatar: mediaUrl(row.avatarId), banned: Boolean(row.bannedAt) }
    });
  }
  return { items, hasMore: rows.length > limit };
}

export async function countPendingAppeals() {
  const rows = await query("SELECT COUNT(*) AS count FROM banAppeal WHERE status = 'pending'");
  return Number(rows[0].count);
}

async function sendDecisionEmail({ user, locale, approved, note }) {
  const subject = approved
    ? tr(locale, '{app} - Votre compte a ete retabli', { app: APP_NAME })
    : tr(locale, '{app} - Resultat de votre demande de revision', { app: APP_NAME });
  const body = approved
    ? tr(locale, 'Bonne nouvelle : apres examen de votre demande, votre compte a ete retabli. Vous pouvez de nouveau vous connecter.')
    : tr(locale, "Apres examen de votre demande, la suspension de votre compte est maintenue.");
  const noteLine = note ? `${tr(locale, 'Message de la moderation')} : ${note}` : '';
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const escape = (value) => String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  await sendMail({
    to: user.email,
    subject,
    text: [tr(locale, 'Bonjour{name},', { name: ` ${user.firstName}` }), body, noteLine].filter(Boolean).join('\n\n'),
    html:
      `<div dir="${dir}" style="font-family:Arial,sans-serif;max-width:460px;margin:auto;padding:24px;color:#1e293b">` +
      `<h2 style="margin:0 0 12px;color:#4548D9">${APP_NAME}</h2>` +
      `<p>${escape(tr(locale, 'Bonjour{name},', { name: ` ${user.firstName}` }))}</p><p>${escape(body)}</p>` +
      (noteLine ? `<p style="background:#F1F1FE;padding:12px 14px;border-radius:12px">${escape(noteLine)}</p>` : '') +
      `</div>`
  });
}

// decision : 'approve' (compte retabli) | 'reject'. Le resultat est envoye par email.
export async function reviewAppeal(adminId, appealId, decision, rawNote) {
  if (!['approve', 'reject'].includes(decision)) return { success: false, message: 'Decision invalide' };
  const note = cleanText(rawNote, 255) || null;
  if (decision === 'reject' && !note) return { success: false, message: 'Un motif est requis' };

  const rows = await query(
    `SELECT a.id, a.status, u.id AS userId, u.email, u.firstName, u.language
     FROM banAppeal a JOIN user u ON u.id = a.userId WHERE a.id = ? LIMIT 1`,
    [appealId]
  );
  const appeal = rows[0];
  if (!appeal) return { success: false, message: 'Demande introuvable' };
  if (appeal.status !== 'pending') return { success: false, message: 'Cette demande a deja ete traitee' };

  const approved = decision === 'approve';
  const update = await query(
    "UPDATE banAppeal SET status = ?, adminNote = ?, reviewedBy = ?, reviewedAt = NOW() WHERE id = ? AND status = 'pending'",
    [approved ? 'approved' : 'rejected', note, adminId, appealId]
  );
  if (update.affectedRows === 0) return { success: false, message: 'Cette demande a deja ete traitee' };

  if (approved) {
    await query('UPDATE user SET bannedAt = NULL, banReason = NULL WHERE id = ?', [appeal.userId]);
    invalidateUserStatus(appeal.userId);
  }
  await query('INSERT INTO adminAudit (adminId, action, targetType, targetId, details) VALUES (?, ?, ?, ?, ?)', [
    adminId,
    approved ? 'appeal_approved' : 'appeal_rejected',
    'user',
    appeal.userId,
    note
  ]);

  let emailSent = true;
  try {
    await sendDecisionEmail({ user: appeal, locale: appeal.language || 'fr', approved, note });
  } catch (error) {
    emailSent = false;
  }
  return { success: true, emailSent };
}

// Un deban fait directement depuis la liste des utilisateurs cloture aussi la
// demande en attente (et previent l'utilisateur).
export async function approvePendingAppealsOnUnban(adminId, userId) {
  const pending = await query("SELECT id FROM banAppeal WHERE userId = ? AND status = 'pending'", [userId]);
  for (const appeal of pending) {
    // eslint-disable-next-line no-await-in-loop
    await query("UPDATE banAppeal SET status = 'approved', reviewedBy = ?, reviewedAt = NOW() WHERE id = ? AND status = 'pending'", [adminId, appeal.id]);
  }
  if (pending.length > 0) {
    const rows = await query('SELECT email, firstName, language FROM user WHERE id = ? LIMIT 1', [userId]);
    if (rows[0]) {
      try {
        await sendDecisionEmail({ user: rows[0], locale: rows[0].language || 'fr', approved: true, note: null });
      } catch (error) {
        // email non critique
      }
    }
  }
}
