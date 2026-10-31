import { getUserFromRequest } from '@/lib/auth';

// Serveurs STUN publics par defaut. Pour que les appels passent partout
// (reseaux mobiles, pare-feu d'entreprise...), definir un serveur TURN dans la
// variable d'environnement ICE_SERVERS (tableau JSON au format RTCIceServer).
const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

function readConfiguredServers() {
  const raw = process.env.ICE_SERVERS;
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch (error) {
    console.warn('ICE_SERVERS n\'est pas un JSON valide, utilisation des serveurs STUN par defaut');
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(200).json({ success: true, iceServers: readConfiguredServers() || DEFAULT_ICE_SERVERS });
}
