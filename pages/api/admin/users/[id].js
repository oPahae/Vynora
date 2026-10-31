import { requireAdmin } from '@/lib/auth';
import { banUser, unbanUser, setUserRole, deleteUserAccount, adminGrantPremium, adminRevokePremium } from '@/lib/moderation';

// Actions sur un compte : ban | unban | promote | demote | delete | grant_premium | revoke_premium
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }
  const admin = await requireAdmin(req, res);
  if (!admin) return undefined;

  const userId = Number(req.query.id);
  if (!Number.isInteger(userId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  const { action, reason, purge } = req.body || {};
  try {
    let result;
    switch (action) {
      case 'ban':
        result = await banUser(admin.id, userId, { reason, purge: Boolean(purge) });
        break;
      case 'unban':
        result = await unbanUser(admin.id, userId);
        break;
      case 'promote':
        result = await setUserRole(admin.id, userId, 'admin');
        break;
      case 'demote':
        result = await setUserRole(admin.id, userId, 'user');
        break;
      case 'grant_premium':
        result = await adminGrantPremium(admin.id, userId, req.body?.days);
        break;
      case 'revoke_premium':
        result = await adminRevokePremium(admin.id, userId);
        break;
      case 'delete':
        result = await deleteUserAccount(admin.id, userId, reason);
        break;
      default:
        return res.status(422).json({ success: false, message: 'Action invalide' });
    }
    return res.status(result.success ? 200 : 422).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
