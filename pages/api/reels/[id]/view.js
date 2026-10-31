import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { getVisibleReelRow } from '@/lib/reels';

// Enregistre le visionnage d'un reel (signal pour la recommandation).
// Appele a la fin de chaque affichage : { watchedMs, durationMs, loops, skipped }.
// Egalement appele via navigator.sendBeacon quand l'utilisateur quitte la page.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const reelId = Number(req.query.id);
  if (!Number.isInteger(reelId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  try {
    const reel = await getVisibleReelRow(payload.id, reelId);
    if (!reel) return res.status(404).json({ success: false, message: 'Reel introuvable' });

    const clamp = (value, max) => Math.max(0, Math.min(Math.round(Number(value) || 0), max));
    const watchedMs = clamp(req.body?.watchedMs, 6 * 60 * 60 * 1000);
    const durationMs = clamp(req.body?.durationMs, 60 * 60 * 1000);
    const loops = clamp(req.body?.loops, 50);
    const skipped = req.body?.skipped ? 1 : 0;
    const ratio = durationMs > 0 ? Math.min(watchedMs / durationMs, 9.99) : 0;

    const result = await query(
      `INSERT INTO reelView (reelId, userId, watchedMs, durationMs, maxRatio, loops, skipped)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         watchedMs = watchedMs + VALUES(watchedMs),
         durationMs = GREATEST(durationMs, VALUES(durationMs)),
         maxRatio = GREATEST(maxRatio, VALUES(maxRatio)),
         loops = loops + VALUES(loops),
         skipped = IF(VALUES(maxRatio) >= 0.5 OR maxRatio >= 0.5, 0, VALUES(skipped))`,
      [reelId, payload.id, watchedMs, durationMs, ratio.toFixed(2), loops, skipped]
    );

    // affectedRows = 1 pour une insertion (premier visionnage) : on ne compte
    // la vue qu'une fois par personne, et jamais celles de l'auteur.
    if (result.affectedRows === 1 && reel.userId !== payload.id) {
      await query('UPDATE reel SET viewsCount = viewsCount + 1 WHERE id = ?', [reelId]);
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
