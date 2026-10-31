import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { parseUpload, getField, saveMediaFile, mediaUrl } from '@/lib/upload';

export const config = {
  api: {
    bodyParser: false
  }
};

const ALLOWED_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/x-m4a', 'audio/mp4'];
const MAX_CLIP_SECONDS = 60;

export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  if (req.method === 'DELETE') {
    await query(
      'UPDATE user SET musicMediaId = NULL, musicTitle = NULL, musicStartSec = 0, musicEndSec = NULL WHERE id = ?',
      [payload.id]
    );
    return res.status(200).json({ success: true });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'DELETE']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  try {
    const { fields, files } = await parseUpload(req, ALLOWED_TYPES);
    if (files.length === 0) {
      return res.status(422).json({ success: false, message: 'Aucun fichier recu' });
    }

    const title = getField(fields, 'title', '').toString().trim().slice(0, 150);
    let startSec = Number(getField(fields, 'startSec', '0'));
    let endSec = Number(getField(fields, 'endSec', ''));

    if (!Number.isFinite(startSec) || startSec < 0) startSec = 0;
    if (!Number.isFinite(endSec) || endSec <= startSec) {
      endSec = startSec + MAX_CLIP_SECONDS;
    }
    if (endSec - startSec > MAX_CLIP_SECONDS) {
      endSec = startSec + MAX_CLIP_SECONDS;
    }

    const mediaId = await saveMediaFile(files[0], payload.id);
    await query('UPDATE user SET musicMediaId = ?, musicTitle = ?, musicStartSec = ?, musicEndSec = ? WHERE id = ?', [
      mediaId,
      title || null,
      startSec,
      endSec,
      payload.id
    ]);

    return res.status(200).json({
      success: true,
      musicUrl: mediaUrl(mediaId),
      musicTitle: title || null,
      musicStartSec: startSec,
      musicEndSec: endSec
    });
  } catch (error) {
    return res.status(422).json({ success: false, message: error.message || 'Erreur lors de l\'upload' });
  }
}
