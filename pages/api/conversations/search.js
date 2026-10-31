import { getUserFromRequest } from '@/lib/auth';
import { searchConversationsAndMessages } from '@/lib/conversations';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const term = (req.query.q || '').toString().trim();
  if (term.length < 2) {
    return res.status(200).json({ success: true, people: [], messages: [] });
  }

  try {
    const result = await searchConversationsAndMessages(payload.id, term);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
