import { getUserFromRequest, comparePassword, hashPassword } from '@/lib/auth';
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

  const currentPassword = (req.body?.currentPassword || '').toString();
  const newPassword = (req.body?.newPassword || '').toString();

  if (newPassword.length < 8) {
    return res.status(422).json({ success: false, message: 'Le nouveau mot de passe doit contenir au moins 8 caracteres' });
  }

  try {
    const rows = await query('SELECT password FROM user WHERE id = ? LIMIT 1', [payload.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    }

    const passwordMatches = await comparePassword(currentPassword, rows[0].password);
    if (!passwordMatches) {
      return res.status(401).json({ success: false, message: 'Mot de passe actuel incorrect' });
    }

    const hashedPassword = await hashPassword(newPassword);
    await query('UPDATE user SET password = ? WHERE id = ?', [hashedPassword, payload.id]);

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
