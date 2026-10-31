import { getUserFromRequest } from '@/lib/auth';
import { publishDraft } from '@/lib/drafts';
import { hydrateFullPosts, POST_SELECT } from '@/lib/posts';
import { query } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const draftId = Number(req.query.id);
  if (!Number.isInteger(draftId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  const result = await publishDraft(payload.id, draftId, []);
  if (!result.success) {
    return res.status(422).json(result);
  }

  const postRows = await query(`${POST_SELECT} WHERE p.id = ? LIMIT 1`, [result.postId]);
  const [hydrated] = await hydrateFullPosts(postRows, payload.id);

  return res.status(200).json({ success: true, post: hydrated });
}
