import { findAccountCandidates, maskEmail } from '@/lib/accountRecovery';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

// "Trouver mon compte" : recherche par nom ou email. Ne renvoie que le nom
// et un email masque (jamais l'email complet).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const term = (req.body?.query || '').toString().trim();
  if (term.length < 2 || term.length > 190) {
    return res.status(422).json({ success: false, message: 'Saisissez au moins 2 caracteres' });
  }

  const limit = rateLimit(`find-account:${getClientIp(req)}`, { max: 15, windowMs: 15 * 60 * 1000 });
  if (!limit.allowed) {
    res.setHeader('Retry-After', Math.ceil(limit.retryAfterMs / 1000));
    return res.status(429).json({ success: false, message: 'Trop de recherches, reessayez dans quelques minutes' });
  }

  try {
    const rows = await findAccountCandidates(term);
    return res.status(200).json({
      success: true,
      accounts: rows.map((row) => ({
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        maskedEmail: maskEmail(row.email)
      }))
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur, veuillez reessayer' });
  }
}
