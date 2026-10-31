import { getUserFromRequest, comparePassword, buildClearAuthCookie } from '@/lib/auth';
import { query } from '@/lib/db';

// Desactivation (reversible) : le profil et le contenu ne sont plus
// accessibles aux autres, la session est fermee. Se reconnecter avec le
// bon mot de passe reactive automatiquement le compte (voir /api/auth/login).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) return res.status(401).json({ success: false, message: 'Non authentifie' });

  const password = (req.body?.password || '').toString();
  if (!password) return res.status(422).json({ success: false, message: 'Mot de passe requis' });

  try {
    const rows = await query('SELECT password FROM user WHERE id = ? LIMIT 1', [payload.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    if (!(await comparePassword(password, rows[0].password))) {
      return res.status(401).json({ success: false, message: 'Mot de passe incorrect' });
    }

    await query('UPDATE user SET deactivatedAt = NOW() WHERE id = ?', [payload.id]);
    if (global.io) global.io.in(`user:${payload.id}`).disconnectSockets();

    res.setHeader('Set-Cookie', buildClearAuthCookie());
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
