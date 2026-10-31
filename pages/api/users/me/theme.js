import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const theme = (req.body?.theme || '').toString();
  if (theme !== 'light' && theme !== 'dark') {
    return res.status(422).json({ success: false, message: 'Theme invalide' });
  }

  try {
    await query('UPDATE user SET theme = ? WHERE id = ?', [theme, payload.id]);
    return res.status(200).json({ success: true, theme });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
