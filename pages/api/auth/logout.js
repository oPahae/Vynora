import { buildClearAuthCookie } from '@/lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  res.setHeader('Set-Cookie', buildClearAuthCookie());
  return res.status(200).json({ success: true, message: 'Deconnexion reussie' });
}
