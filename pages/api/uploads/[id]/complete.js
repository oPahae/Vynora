import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false
  }
};

// Assemble les morceaux recus en un seul media. Idempotent : un second appel
// renvoie le meme mediaId.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const sessionId = String(req.query.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  try {
    const rows = await query('SELECT * FROM uploadSession WHERE id = ? AND userId = ? LIMIT 1', [sessionId, payload.id]);
    const session = rows[0];
    if (!session) return res.status(404).json({ success: false, message: 'Session introuvable' });
    if (session.mediaId) return res.status(200).json({ success: true, mediaId: session.mediaId });

    const chunkRows = await query('SELECT idx, data FROM uploadChunk WHERE sessionId = ? ORDER BY idx', [sessionId]);
    if (chunkRows.length !== session.totalChunks) {
      const have = new Set(chunkRows.map((row) => row.idx));
      const missing = [];
      for (let i = 0; i < session.totalChunks; i += 1) if (!have.has(i)) missing.push(i);
      return res.status(409).json({ success: false, message: 'Morceaux manquants', missing });
    }

    const buffer = Buffer.concat(chunkRows.map((row) => row.data));
    if (buffer.length !== Number(session.size)) {
      return res.status(422).json({ success: false, message: 'Taille du fichier inattendue' });
    }

    const result = await query('INSERT INTO media (uploaderId, mimetype, data, size) VALUES (?, ?, ?, ?)', [
      payload.id,
      session.mimetype,
      buffer,
      buffer.length
    ]);
    await query('UPDATE uploadSession SET mediaId = ?, updatedAt = NOW() WHERE id = ?', [result.insertId, sessionId]);
    await query('DELETE FROM uploadChunk WHERE sessionId = ?', [sessionId]);

    return res.status(200).json({ success: true, mediaId: result.insertId });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
