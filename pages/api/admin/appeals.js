import { requireAdmin } from '@/lib/auth';
import { listAppeals, reviewAppeal } from '@/lib/appeals';

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return undefined;

  try {
    if (req.method === 'GET') {
      const result = await listAppeals((req.query.status || 'pending').toString(), Math.max(Number(req.query.offset) || 0, 0), 20);
      return res.status(200).json({ success: true, ...result });
    }
    if (req.method === 'POST') {
      const { id, decision, note } = req.body || {};
      const result = await reviewAppeal(admin.id, Number(id), (decision || '').toString(), note);
      return res.status(result.success ? 200 : 422).json(result);
    }
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
