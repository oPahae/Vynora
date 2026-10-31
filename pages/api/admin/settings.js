import { requireAdmin } from '@/lib/auth';
import { getSettings, updateSettings } from '@/lib/settings';
import { audit } from '@/lib/moderation';
import { getPaypalMode, isPaypalConfigured } from '@/lib/paypal';

// Parametres modifiables (prix premium, devise PayPal, taux, duree, boosts).
export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return undefined;

  try {
    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        settings: await getSettings(),
        paypal: { configured: isPaypalConfigured(), mode: getPaypalMode() }
      });
    }
    if (req.method === 'PUT') {
      const result = await updateSettings(req.body || {});
      if (!result.success) return res.status(422).json(result);
      await audit(admin.id, 'update_settings', null, null, JSON.stringify(req.body).slice(0, 400));
      return res.status(200).json({ success: true, settings: await getSettings() });
    }
    res.setHeader('Allow', ['GET', 'PUT']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
