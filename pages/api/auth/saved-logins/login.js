import { verifySavedLogin, touchSavedLogin, revokeSavedLogin, buildSavedLoginCookie, buildClearSavedLoginCookie } from '@/lib/savedLogins';
import { startSession, rejectIfBlocked } from '@/lib/loginSession';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

// Connexion SANS mot de passe depuis l'Account Center : valable uniquement si
// ce navigateur possede la connexion enregistree de ce compte.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const userId = Number(req.body?.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  const limit = rateLimit(`saved-login:${getClientIp(req)}`, { max: 30, windowMs: 15 * 60 * 1000 });
  if (!limit.allowed) {
    res.setHeader('Retry-After', Math.ceil(limit.retryAfterMs / 1000));
    return res.status(429).json({ success: false, message: 'Trop de tentatives, reessayez dans quelques minutes' });
  }

  try {
    const row = await verifySavedLogin(req, userId);
    if (!row) {
      await revokeSavedLogin(req, userId);
      res.setHeader('Set-Cookie', buildClearSavedLoginCookie(userId));
      return res.status(401).json({
        success: false,
        expired: true,
        message: 'Cette connexion enregistree a expire, saisissez votre mot de passe'
      });
    }
    if (await rejectIfBlocked(res, row)) return undefined;

    // Un compte desactive ne se reactive qu'avec le mot de passe.
    if (row.deactivatedAt) {
      return res.status(403).json({
        success: false,
        needsPassword: true,
        message: 'Ce compte est desactive : connectez-vous avec votre mot de passe pour le reactiver'
      });
    }

    await touchSavedLogin(row.savedId);
    const session = await startSession(req, res, row, {
      // Renouvelle le cookie (expiration glissante).
      extraCookies: [buildSavedLoginCookie(userId, req.cookies[`vyn_sl_${userId}`])]
    });
    return res.status(200).json({ success: true, message: 'Connexion reussie', ...session });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur, veuillez reessayer' });
  }
}
