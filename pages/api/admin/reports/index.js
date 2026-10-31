import { requireAdmin } from '@/lib/auth';
import { listReportGroups, getReportDetail } from '@/lib/admin';
import { resolveReports } from '@/lib/moderation';
import { REPORT_TARGETS } from '@/lib/reports';

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return undefined;

  try {
    if (req.method === 'GET') {
      // ?targetType=&targetId= : detail des signalements d'une cible
      if (req.query.targetType && req.query.targetId) {
        const targetType = req.query.targetType.toString();
        const targetId = Number(req.query.targetId);
        if (!REPORT_TARGETS.includes(targetType) || !Number.isInteger(targetId)) {
          return res.status(422).json({ success: false, message: 'Requete invalide' });
        }
        const reports = await getReportDetail(targetType, targetId);
        return res.status(200).json({ success: true, reports });
      }

      const offset = Math.max(Number(req.query.offset) || 0, 0);
      const result = await listReportGroups((req.query.status || 'pending').toString(), offset, 20);
      return res.status(200).json({ success: true, ...result });
    }

    if (req.method === 'POST') {
      const { targetType, targetId, action, reason, purge } = req.body || {};
      if (!REPORT_TARGETS.includes(targetType) || !Number.isInteger(Number(targetId))) {
        return res.status(422).json({ success: false, message: 'Requete invalide' });
      }
      const result = await resolveReports(admin.id, targetType, Number(targetId), action, {
        reason,
        purge: Boolean(purge)
      });
      return res.status(result.success ? 200 : 422).json(result);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
