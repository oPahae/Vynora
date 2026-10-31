import { IncomingForm } from 'formidable';
import { Writable } from 'stream';
import { query } from './db';

export function getField(fields, name, defaultValue = '') {
  const value = fields[name];
  if (Array.isArray(value)) {
    return value.length > 0 ? value[0] : defaultValue;
  }
  return value !== undefined ? value : defaultValue;
}

function createMemoryWriteStream(file) {
  const chunks = [];
  const writable = new Writable({
    write(chunk, encoding, callback) {
      chunks.push(chunk);
      callback();
    }
  });
  writable.on('finish', () => {
    file.buffer = Buffer.concat(chunks);
  });
  return writable;
}

// Aucune limite de taille par defaut : MAX_UPLOAD_SIZE dans .env permet de
// fixer un plafond si besoin (en octets), mais tant qu'elle n'est pas
// definie, formidable n'impose aucune limite (Infinity).
const DEFAULT_MAX_UPLOAD_SIZE = process.env.MAX_UPLOAD_SIZE
  ? Number(process.env.MAX_UPLOAD_SIZE)
  : Infinity;

export async function parseUpload(req, allowedTypes, options = {}) {
  const form = new IncomingForm({
    fileWriteStreamHandler: createMemoryWriteStream,
    maxFileSize: options.maxFileSize ?? DEFAULT_MAX_UPLOAD_SIZE,
    maxTotalFileSize: options.maxFileSize ?? DEFAULT_MAX_UPLOAD_SIZE
  });

  const [fields, files] = await form.parse(req);

  const fileList = Object.values(files)
    .flat()
    .filter(Boolean);

  fileList.forEach((file) => {
    if (allowedTypes && allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
      throw new Error('Type de fichier non autorise');
    }
  });

  return { fields, files: fileList };
}

export async function saveMediaFile(file, uploaderId) {
  const result = await query('INSERT INTO media (uploaderId, mimetype, data, size) VALUES (?, ?, ?, ?)', [
    uploaderId,
    file.mimetype,
    file.buffer,
    file.buffer.length
  ]);
  return result.insertId;
}

export async function saveMediaFiles(fileList, uploaderId) {
  const ids = [];
  for (const file of fileList) {
    const id = await saveMediaFile(file, uploaderId);
    ids.push(id);
  }
  return ids;
}

export function mediaUrl(mediaId) {
  return mediaId ? `/api/media/${mediaId}` : null;
}

const EXTENSION_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/ogg': '.ogv',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/webm': '.weba',
  'audio/ogg': '.oga',
  'audio/wav': '.wav',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/zip': '.zip',
  'text/plain': '.txt'
};

export function extensionForMime(mimetype) {
  return EXTENSION_BY_MIME[mimetype] || '';
}

// Nettoie un nom de fichier fourni par le client avant de l'utiliser dans un
// en-tete Content-Disposition (pas de separateurs de chemin ni de guillemets).
export function sanitizeDownloadFilename(name) {
  if (!name) return '';
  return name
    .replace(/["\\/\r\n]/g, '')
    .trim()
    .slice(0, 150);
}

export function withAvatarUrl(rows) {
  return rows.map((row) => {
    const { avatarId, ...rest } = row;
    const result = { ...rest, avatar: mediaUrl(avatarId) };
    // Badge "verifie" (Premium / administrateur) si la requete l'a calcule.
    if ('verified' in row) result.verified = Boolean(row.verified);
    return result;
  });
}

export function withProfileUrls(row) {
  if (!row) return row;
  const { avatarId, coverId, musicMediaId, socialLinks, ...rest } = row;

  let parsedSocialLinks = socialLinks || {};
  if (typeof parsedSocialLinks === 'string') {
    try {
      parsedSocialLinks = JSON.parse(parsedSocialLinks);
    } catch (error) {
      parsedSocialLinks = {};
    }
  }

  return {
    ...rest,
    avatar: mediaUrl(avatarId),
    cover: mediaUrl(coverId),
    musicUrl: mediaUrl(musicMediaId),
    socialLinks: parsedSocialLinks
  };
}
