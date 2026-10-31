import { getUserFromRequest } from '@/lib/auth';
import { createReport } from '@/lib/reports';
import { logActivity } from '@/lib/activity';
import { rateLimit } from '@/lib/rateLimit';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  // Anti-abus : 20 signalements par heure et par utilisateur.
  const limit = rateLimit(`report:${payload.id}`, { max: 20, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) {
    return res.status(429).json({ success: false, message: 'Trop de signalements, reessayez plus tard' });
  }

  try {
    const { targetType, targetId, reason, details } = req.body || {};
    const result = await createReport(payload.id, {
      targetType: (targetType || '').toString(),
      targetId: Number(targetId),
      reason: (reason || '').toString(),
      details
    });

    if (!result.success) {
      return res.status(result.status || 422).json({ success: false, message: result.message });
    }

    await logActivity(payload.id, 'report_submit', { targetType, targetId: Number(targetId), meta: { reason } });
    return res.status(201).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
