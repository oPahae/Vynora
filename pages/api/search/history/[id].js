import { getUserFromRequest } from '@/lib/auth';
import { deleteSearchHistoryEntry } from '@/lib/search';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const id = Number(req.query.id);
  if (!Number.isInteger(id)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  await deleteSearchHistoryEntry(payload.id, id);
  return res.status(200).json({ success: true });
}
