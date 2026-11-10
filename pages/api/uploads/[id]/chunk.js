import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { readRawBody, MAX_CHUNK_BYTES } from '@/lib/uploadSessions';

export const config = {
  api: {
    bodyParser: false
  }
};

// Recoit un morceau (corps binaire brut) : PUT /api/uploads/<session>/chunk?index=N
export default async function handler(req, res) {
  if (req.method !== 'PUT' && req.method !== 'POST') {
    res.setHeader('Allow', ['PUT', 'POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const sessionId = String(req.query.id || '');
  const index = Number(req.query.index);
  if (!/^[0-9a-f-]{36}$/i.test(sessionId) || !Number.isInteger(index) || index < 0) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  try {
    const rows = await query('SELECT * FROM uploadSession WHERE id = ? AND userId = ? LIMIT 1', [sessionId, payload.id]);
    const session = rows[0];
    if (!session) return res.status(404).json({ success: false, message: 'Session introuvable' });
    if (session.mediaId) return res.status(200).json({ success: true, done: true });
    if (index >= session.totalChunks) {
      return res.status(422).json({ success: false, message: 'Morceau invalide' });
    }

    const data = await readRawBody(req, MAX_CHUNK_BYTES);
    const isLast = index === session.totalChunks - 1;
    const expected = isLast ? Number(session.size) - index * session.chunkSize : session.chunkSize;
    if (data.length !== expected) {
      return res.status(422).json({ success: false, message: 'Taille de morceau inattendue' });
    }

    await query(
      'INSERT INTO uploadChunk (sessionId, idx, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)',
      [sessionId, index, data]
    );
    await query('UPDATE uploadSession SET updatedAt = NOW() WHERE id = ?', [sessionId]);

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
