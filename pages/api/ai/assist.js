import { getUserFromRequest } from '@/lib/auth';
import { getRequestLocale } from '@/lib/i18n/server';
import { runAiAssist, isAiConfigured, AI_ACTIONS } from '@/lib/aiAssistant';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  if (!isAiConfigured) {
    return res.status(503).json({
      success: false,
      message: "Assistant IA non configure sur ce serveur (variable d'environnement AI_API_KEY manquante)."
    });
  }

  const action = (req.body?.action || '').toString();
  const text = (req.body?.text || '').toString();

  if (!AI_ACTIONS.includes(action)) {
    return res.status(422).json({ success: false, message: 'Action IA inconnue' });
  }

  const result = await runAiAssist(payload.id, action, text, getRequestLocale(req));
  if (!result.success) {
    return res.status(result.status || 500).json({ success: false, message: result.message });
  }

  return res.status(200).json({ success: true, result: result.result });
}
