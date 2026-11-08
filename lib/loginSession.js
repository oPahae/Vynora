import { query } from './db';
import { logActivity } from './activity';
import { signToken, buildAuthCookie } from './auth';
import { mediaUrl } from './upload';
import { getClientIp } from './rateLimit';
import { readDeviceCookie, newDeviceId, buildDeviceCookie, recordLoginDevice } from './devices';

// Colonnes necessaires pour ouvrir une session.
export const SESSION_USER_COLUMNS =
  'id, firstName, lastName, email, avatarId, coverId, language, deactivatedAt, role, bannedAt, banReason';

// Ouvre la session d'un utilisateur deja authentifie par un autre moyen
// (Google, connexion enregistree) : cookie de session, appareil, journal.
// Reproduit ce que fait /api/auth/login apres la verification du mot de passe.
export async function startSession(req, res, user, { extraCookies = [] } = {}) {
  const wasDeactivated = Boolean(user.deactivatedAt);
  const token = await signToken({ id: user.id, email: user.email });
  await query('UPDATE user SET lastSeenAt = NOW(), deactivatedAt = NULL WHERE id = ?', [user.id]);
  await logActivity(user.id, 'login', { meta: { ip: getClientIp(req) } });

  const deviceId = readDeviceCookie(req) || newDeviceId();
  res.setHeader('Set-Cookie', [buildAuthCookie(token), buildDeviceCookie(deviceId), ...extraCookies]);
  res.on('finish', () => {
    recordLoginDevice({ user, req, deviceId });
  });

  return {
    reactivated: wasDeactivated,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      avatar: mediaUrl(user.avatarId),
      cover: mediaUrl(user.coverId),
      language: user.language || null,
      role: user.role
    }
  };
}

// Reponse d'erreur commune pour un compte banni / supprime.
export async function rejectIfBlocked(res, user) {
  if (user.bannedAt) {
    res.status(403).json({
      success: false,
      banned: true,
      reason: user.banReason || null,
      message: user.banReason
        ? `Ce compte a ete suspendu par l'administration. Motif : ${user.banReason}`
        : "Ce compte a ete suspendu par l'administration."
    });
    return true;
  }
  return false;
}
