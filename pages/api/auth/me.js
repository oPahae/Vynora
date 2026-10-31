import { getUserFromRequest, buildClearAuthCookie, verifyToken, AUTH_COOKIE_NAME } from '@/lib/auth';
import { isPremiumDate } from '@/lib/premium';
import { query } from '@/lib/db';
import { withProfileUrls } from '@/lib/upload';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    // Session invalide : si le jeton est valide mais que le compte a ete banni
    // ou supprime, on le dit (avec le motif) pour que l'interface deconnecte
    // l'utilisateur et affiche pourquoi.
    try {
      const token = req.cookies ? req.cookies[AUTH_COOKIE_NAME] : null;
      const decoded = token ? await verifyToken(token) : null;
      if (decoded) {
        const rows = await query('SELECT bannedAt, banReason FROM user WHERE id = ? LIMIT 1', [decoded.id]);
        res.setHeader('Set-Cookie', buildClearAuthCookie());
        if (rows[0] && rows[0].bannedAt) {
          return res.status(401).json({ success: false, message: 'Compte suspendu', terminated: 'banned', reason: rows[0].banReason || null });
        }
        if (!rows[0]) {
          const deleted = await query('SELECT reason FROM deletedAccount WHERE email = ? LIMIT 1', [String(decoded.email).toLowerCase()]);
          if (deleted[0]) {
            return res.status(401).json({ success: false, message: 'Compte supprime', terminated: 'deleted', reason: deleted[0].reason || null });
          }
        }
      }
    } catch (error) {
      // on retombe sur la reponse generique
    }
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  try {
    const rows = await query(
      'SELECT id, firstName, lastName, email, avatarId, coverId, bio, work, education, city, country, phone, theme, language, isPrivate, showOnlineStatus, showReadReceipts, deactivatedAt, role, bannedAt, banReason, premiumUntil FROM user WHERE id = ? LIMIT 1',
      [payload.id]
    );

    if (rows.length === 0) {
      res.setHeader('Set-Cookie', buildClearAuthCookie());
      return res.status(401).json({ success: false, message: 'Non authentifie' });
    }
    if (rows[0].bannedAt) {
      res.setHeader('Set-Cookie', buildClearAuthCookie());
      return res.status(401).json({ success: false, message: 'Compte suspendu', terminated: 'banned', reason: rows[0].banReason || null });
    }
    if (rows[0].deactivatedAt) {
      // Desactive depuis un autre appareil : on ferme cette session aussi,
      // la reactivation se fait uniquement via un nouveau login.
      res.setHeader('Set-Cookie', buildClearAuthCookie());
      return res.status(401).json({ success: false, message: 'Compte desactive', deactivated: true });
    }

    const { bannedAt, banReason, premiumUntil, ...userRow } = rows[0];
    return res.status(200).json({ success: true, user: { ...withProfileUrls(userRow), isPremium: isPremiumDate(premiumUntil) || userRow.role === 'admin' } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
