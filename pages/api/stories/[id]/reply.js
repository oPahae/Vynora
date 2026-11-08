import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { canViewStory } from '@/lib/stories';
import { sendDirectMessage } from '@/lib/directMessages';
import { rateLimit } from '@/lib/rateLimit';

// Repondre a une story : le texte part en message prive a l'auteur, avec un
// apercu de la story attache au message.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) return res.status(401).json({ success: false, message: 'Non authentifie' });

  const storyId = Number(req.query.id);
  if (!Number.isInteger(storyId)) return res.status(422).json({ success: false, message: 'Requete invalide' });

  const content = (req.body?.content || '').toString().trim().slice(0, 2000);
  if (!content) return res.status(422).json({ success: false, message: 'Le message ne peut pas etre vide' });

  const limit = rateLimit(`story-reply:${payload.id}`, { max: 60, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) return res.status(429).json({ success: false, message: 'Trop de messages, reessayez plus tard' });

  try {
    const rows = await query('SELECT * FROM status WHERE id = ? AND expiresAt > NOW() LIMIT 1', [storyId]);
    const story = rows[0];
    if (!story) return res.status(404).json({ success: false, message: 'Story introuvable ou expiree' });
    if (story.userId === payload.id) {
      return res.status(422).json({ success: false, message: 'Vous ne pouvez pas repondre a votre propre story' });
    }
    if (!(await canViewStory(payload.id, story))) {
      return res.status(403).json({ success: false, message: 'Action non autorisee' });
    }

    const result = await sendDirectMessage({
      senderId: payload.id,
      targetUserId: story.userId,
      content,
      type: 'text',
      storyId
    });
    if (!result.success) return res.status(result.status || 422).json(result);
    return res.status(201).json({ success: true, message: result.message, conversationId: result.conversationId });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
