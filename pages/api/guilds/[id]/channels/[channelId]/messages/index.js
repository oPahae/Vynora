import { allowMethods, requireMember, requireChannel, denyUnless } from '@/lib/guildApi';
import { parseUpload, getField, saveMediaFile } from '@/lib/upload';
import {
  listMessages,
  createMessage,
  getSlowmodeRemaining,
  getMentionCandidates,
  extractMentionedIds,
  notifyMentions,
  can,
  emitToChannel,
  MAX_MESSAGE_LENGTH
} from '@/lib/guilds';
import { PERMISSIONS } from '@/lib/guildPermissions';

// Multipart (comme les messages prives) pour autoriser les pieces jointes :
// desactive le bodyParser JSON par defaut de Next.js sur cette route.
export const config = {
  api: {
    bodyParser: false
  }
};

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/webm',
  'audio/ogg',
  'audio/wav',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'text/plain'
];

function messageTypeFromMime(mimetype) {
  if (mimetype.startsWith('image')) return 'image';
  if (mimetype.startsWith('video')) return 'video';
  if (mimetype.startsWith('audio')) return 'audio';
  return 'file';
}

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST'])) return;
  const member = await requireMember(req, res);
  if (!member) return;
  const channel = await requireChannel(req, res, member);
  if (!channel) return;
  if (channel.type !== 'text') {
    return res.status(400).json({ success: false, message: "Ce salon n'est pas textuel" });
  }

  if (req.method === 'GET') {
    try {
      const beforeId = Number(req.query.before) || null;
      const data = await listMessages(channel.id, beforeId);
      return res.status(200).json({ success: true, ...data });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  if (!denyUnless(res, can(member.context, PERMISSIONS.SEND_MESSAGES), "Vous ne pouvez pas ecrire dans ce salon")) return;

  try {
    const { fields, files } = await parseUpload(req, ALLOWED_TYPES);
    const content = getField(fields, 'content').toString().trim();

    if (!content && files.length === 0) {
      return res.status(422).json({ success: false, message: 'Message vide' });
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      return res.status(422).json({ success: false, message: `Message trop long (${MAX_MESSAGE_LENGTH} caracteres max)` });
    }

    // Mode lent : ignore pour ceux qui ont la permission BYPASS_SLOWMODE.
    if (!can(member.context, PERMISSIONS.BYPASS_SLOWMODE)) {
      const remaining = await getSlowmodeRemaining(channel, member.userId);
      if (remaining > 0) {
        return res.status(429).json({
          success: false,
          message: `Mode lent actif : patientez encore ${remaining} s`,
          retryAfterSeconds: remaining
        });
      }
    }

    let media = null;
    if (files.length > 0) {
      const mediaId = await saveMediaFile(files[0], member.userId);
      media = { type: messageTypeFromMime(files[0].mimetype), mediaId, fileName: files[0].originalFilename };
    }

    // Chaine vide (et non NULL) pour un message sans texte : fonctionne meme si
    // la colonne `content` de la base est encore NOT NULL (migration 010/011 non appliquee).
    const message = await createMessage(channel, member.userId, content || '', media);
    await emitToChannel(channel, 'guild:message', message);

    // Mentions (@membre / @role) : notifie ceux qui peuvent voir le salon.
    if (content) {
      const candidates = await getMentionCandidates(channel.guildId);
      const mentioned = extractMentionedIds(content, candidates);
      notifyMentions(channel, message, mentioned).catch((error) => console.error('notifyMentions', error));
    }

    return res.status(201).json({ success: true, message });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
