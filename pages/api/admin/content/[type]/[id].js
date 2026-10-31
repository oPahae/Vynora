import { requireAdmin } from '@/lib/auth';
import { deleteContent, DELETABLE_TYPES } from '@/lib/moderation';

// Suppression d'un contenu par un administrateur (post, commentaire, reel,
// commentaire de reel, groupe, serveur, story).
export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }
  const admin = await requireAdmin(req, res);
  if (!admin) return undefined;

  const type = (req.query.type || '').toString();
  const id = Number(req.query.id);
  if (!DELETABLE_TYPES.includes(type) || type === 'user' || !Number.isInteger(id)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  try {
    const result = await deleteContent(admin.id, type, id, req.body?.reason);
    return res.status(result.success ? 200 : result.message === 'Un motif est requis' ? 422 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
