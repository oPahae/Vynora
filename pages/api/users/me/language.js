import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { isSupportedLocale } from '@/lib/i18n/config';
import { getRequestLocale, tr } from '@/lib/i18n/server';

export default async function handler(req, res) {
  const locale = getRequestLocale(req);
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ success: false, message: tr(locale, 'Methode non autorisee') });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: tr(locale, 'Non authentifie') });
  }

  const language = (req.body?.language || '').toString();
  if (!isSupportedLocale(language)) {
    return res.status(422).json({ success: false, message: tr(locale, 'Langue invalide') });
  }

  try {
    await query('UPDATE user SET language = ? WHERE id = ?', [language, payload.id]);
    return res.status(200).json({ success: true, language });
  } catch (error) {
    return res.status(500).json({ success: false, message: tr(locale, 'Erreur serveur') });
  }
}
