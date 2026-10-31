import { getUserFromRequest } from '@/lib/auth';
import { getPresenceStatus, setPresenceStatus, clearPresenceStatus, computeExpiresAt } from '@/lib/presenceStatus';

const MAX_LABEL_LENGTH = 80;
const VALID_DURATIONS = ['1h', '4h', 'today', 'none'];

export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  if (req.method === 'GET') {
    const status = await getPresenceStatus(payload.id);
    return res.status(200).json({ success: true, status });
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    const emoji = (req.body?.emoji || '').toString().trim().slice(0, 16);
    const label = (req.body?.label || '').toString().trim().slice(0, MAX_LABEL_LENGTH);
    const duration = (req.body?.duration || 'none').toString();

    if (!label) {
      return res.status(422).json({ success: false, message: 'Le statut ne peut pas etre vide' });
    }
    if (!VALID_DURATIONS.includes(duration)) {
      return res.status(422).json({ success: false, message: 'Duree invalide' });
    }

    const expiresAt = computeExpiresAt(duration);
    const status = await setPresenceStatus(payload.id, {
      emoji: emoji || null,
      label,
      expiresAt: expiresAt ? expiresAt.toISOString().slice(0, 19).replace('T', ' ') : null
    });

    if (global.io) {
      global.io.emit('presence:status', { userId: payload.id, status });
    }

    return res.status(200).json({ success: true, status });
  }

  if (req.method === 'DELETE') {
    await clearPresenceStatus(payload.id);
    if (global.io) {
      global.io.emit('presence:status', { userId: payload.id, status: null });
    }
    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', ['GET', 'PUT', 'POST', 'DELETE']);
  return res.status(405).json({ success: false, message: 'Methode non autorisee' });
}
