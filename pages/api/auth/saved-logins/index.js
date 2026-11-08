import { getUserFromRequest } from '@/lib/auth';
import {
  createSavedLogin,
  listSavedAccounts,
  revokeSavedLogin,
  buildSavedLoginCookie,
  buildClearSavedLoginCookie
} from '@/lib/savedLogins';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

// Account Center :
//  GET    -> comptes enregistres sur CE navigateur (aucune session requise)
//  POST   -> enregistre la connexion du compte actuellement connecte
//  DELETE -> ?userId=ID : oublie ce compte sur ce navigateur
export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { accounts, staleIds } = await listSavedAccounts(req);
      if (staleIds.length > 0) res.setHeader('Set-Cookie', staleIds.map((id) => buildClearSavedLoginCookie(id)));
      res.setHeader('Cache-Control', 'no-store');
      const current = await getUserFromRequest(req);
      return res.status(200).json({ success: true, accounts, currentUserId: current ? current.id : null });
    }

    if (req.method === 'POST') {
      const payload = await getUserFromRequest(req);
      if (!payload) return res.status(401).json({ success: false, message: 'Non authentifie' });
      const limit = rateLimit(`saved-login-create:${getClientIp(req)}`, { max: 20, windowMs: 60 * 60 * 1000 });
      if (!limit.allowed) return res.status(429).json({ success: false, message: 'Trop de tentatives, reessayez plus tard' });

      const token = await createSavedLogin(req, payload.id);
      res.setHeader('Set-Cookie', buildSavedLoginCookie(payload.id, token));
      return res.status(201).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const userId = Number(req.query.userId);
      if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(422).json({ success: false, message: 'Requete invalide' });
      }
      await revokeSavedLogin(req, userId);
      res.setHeader('Set-Cookie', buildClearSavedLoginCookie(userId));
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
