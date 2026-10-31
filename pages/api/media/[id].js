import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { extensionForMime, sanitizeDownloadFilename } from '@/lib/upload';

export const config = {
  api: {
    responseLimit: false
  }
};

// Parse une en-tete Range HTTP de la forme "bytes=start-end", "bytes=start-"
// ou "bytes=-suffixLength". Retourne null/invalide si l'en-tete est absente
// ou mal formee.
function parseRange(rangeHeader, totalSize) {
  if (!rangeHeader) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return { invalid: true };

  const [, startStr, endStr] = match;

  if (startStr === '' && endStr === '') {
    return { invalid: true };
  }

  let start;
  let end;

  if (startStr === '') {
    // Suffix range : les N derniers octets du fichier ("bytes=-500")
    const suffixLength = parseInt(endStr, 10);
    start = Math.max(totalSize - suffixLength, 0);
    end = totalSize - 1;
  } else {
    start = parseInt(startStr, 10);
    end = endStr === '' ? totalSize - 1 : parseInt(endStr, 10);
  }

  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= totalSize) {
    return { invalid: true };
  }

  return { start, end: Math.min(end, totalSize - 1) };
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', ['GET', 'HEAD']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const mediaId = Number(req.query.id);
  if (!Number.isInteger(mediaId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  try {
    const rows = await query('SELECT mimetype, data, size FROM media WHERE id = ? LIMIT 1', [mediaId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Media introuvable' });
    }

    const media = rows[0];
    const totalSize = media.size;

    // Accept-Ranges + gestion du 206 Partial Content : indispensable pour que
    // <audio>/<video> puissent chercher (seek) et demarrer la lecture a un
    // instant precis (currentTime) au lieu de re-telecharger le fichier
    // entier depuis le debut a chaque fois (c'etait la cause du bug musique
    // qui ne demarrait jamais a l'extrait choisi, et de la barre de
    // progression video qui repartait a zero).
    res.setHeader('Content-Type', media.mimetype);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=86400');

    // ?download=1 (avec un ?filename= optionnel pour garder le nom original,
    // utilise notamment pour les pieces jointes des messages) force le
    // telechargement au lieu d'un affichage inline dans le navigateur.
    const wantsDownload = req.query.download === '1' || req.query.download === 'true';
    if (wantsDownload) {
      const requestedName = Array.isArray(req.query.filename) ? req.query.filename[0] : req.query.filename;
      const safeName =
        sanitizeDownloadFilename(requestedName) || `media-${mediaId}${extensionForMime(media.mimetype)}`;
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    }

    const range = parseRange(req.headers.range, totalSize);

    if (range) {
      if (range.invalid) {
        res.setHeader('Content-Range', `bytes */${totalSize}`);
        return res.status(416).end();
      }

      const { start, end } = range;
      const chunkSize = end - start + 1;

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
      res.setHeader('Content-Length', chunkSize);

      if (req.method === 'HEAD') return res.end();
      return res.end(media.data.subarray(start, end + 1));
    }

    res.setHeader('Content-Length', totalSize);
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).send(media.data);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
