import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { readJsonBody, newSessionId, purgeStaleSessions, MAX_CHUNK_BYTES, POST_MEDIA_TYPES } from '@/lib/uploadSessions';

export const config = {
  api: {
    bodyParser: false
  }
};

// Ouvre (ou retrouve) une session d'envoi par morceaux. Idempotent grace a
// `clientKey` : apres un rechargement de page, le client redemande la meme
// session et recoit la liste des morceaux deja recus.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  try {
    const body = await readJsonBody(req);
    const clientKey = String(body.clientKey || '').slice(0, 80);
    const mimetype = String(body.mimetype || '');
    const size = Number(body.size);
    const chunkSize = Math.min(Number(body.chunkSize) || MAX_CHUNK_BYTES, MAX_CHUNK_BYTES);
    const filename = String(body.filename || '').slice(0, 255) || null;

    if (!clientKey || !Number.isFinite(size) || size <= 0 || !Number.isFinite(chunkSize) || chunkSize <= 0) {
      return res.status(422).json({ success: false, message: 'Requete invalide' });
    }
    if (!POST_MEDIA_TYPES.includes(mimetype)) {
      return res.status(422).json({ success: false, message: 'Type de fichier non autorise' });
    }
    const maxUpload = process.env.MAX_UPLOAD_SIZE ? Number(process.env.MAX_UPLOAD_SIZE) : Infinity;
    if (size > maxUpload || size > 4 * 1024 * 1024 * 1024 - 1) {
      return res.status(413).json({ success: false, message: 'Fichier trop volumineux' });
    }

    purgeStaleSessions();

    let rows = await query('SELECT * FROM uploadSession WHERE userId = ? AND clientKey = ? LIMIT 1', [payload.id, clientKey]);
    if (rows.length === 0) {
      const id = newSessionId();
      const totalChunks = Math.ceil(size / chunkSize);
      await query(
        `INSERT IGNORE INTO uploadSession (id, userId, clientKey, filename, mimetype, size, chunkSize, totalChunks)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, payload.id, clientKey, filename, mimetype, size, chunkSize, totalChunks]
      );
      rows = await query('SELECT * FROM uploadSession WHERE userId = ? AND clientKey = ? LIMIT 1', [payload.id, clientKey]);
    }

    const session = rows[0];
    let received = [];
    if (!session.mediaId) {
      const chunkRows = await query('SELECT idx FROM uploadChunk WHERE sessionId = ? ORDER BY idx', [session.id]);
      received = chunkRows.map((row) => row.idx);
    }

    return res.status(200).json({
      success: true,
      sessionId: session.id,
      chunkSize: session.chunkSize,
      totalChunks: session.totalChunks,
      received,
      mediaId: session.mediaId || null
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
