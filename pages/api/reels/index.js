import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { parseUpload, getField, saveMediaFile } from '@/lib/upload';
import {
  REEL_SELECT,
  REEL_MAX_DURATION_SEC,
  REEL_MAX_FILE_BYTES,
  REEL_VIDEO_TYPES,
  getRecommendedReels,
  getChronologicalReels,
  hydrateReels,
  reelVisibilitySql,
  syncReelHashtags
} from '@/lib/reels';
import { getCollectionRow, canViewCollection } from '@/lib/collections';
import { logActivity, snippet } from '@/lib/activity';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false
  }
};

const VISIBILITIES = ['public', 'friends', 'private'];

async function handleGet(req, res, payload) {
  const mode = (req.query.mode || 'forYou').toString();
  const limit = Math.min(Math.max(Number(req.query.limit) || 6, 1), 12);

  if (mode === 'forYou') {
    const exclude = (req.query.exclude || '')
      .toString()
      .split(',')
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0);
    const reels = await getRecommendedReels(payload.id, { exclude, limit });
    return res.status(200).json({ success: true, reels, hasMore: reels.length === limit });
  }

  if (mode === 'friends' || mode === 'user') {
    const userId = Number(req.query.userId);
    if (mode === 'user' && !Number.isInteger(userId)) {
      return res.status(422).json({ success: false, message: 'Requete invalide' });
    }
    const result = await getChronologicalReels(payload.id, { mode, userId, before: req.query.before, limit });
    return res.status(200).json({ success: true, ...result });
  }

  if (mode === 'collection') {
    const collection = await getCollectionRow(Number(req.query.collectionId));
    if (!collection || !(await canViewCollection(payload.id, collection))) {
      return res.status(404).json({ success: false, message: 'Collection introuvable' });
    }
    const orderRows = await query(
      "SELECT itemId FROM collectionItem WHERE collectionId = ? AND itemType = 'reel' ORDER BY position ASC, id ASC",
      [collection.id]
    );
    const ids = orderRows.map((row) => row.itemId);
    if (ids.length === 0) return res.status(200).json({ success: true, reels: [], hasMore: false });

    const vis = reelVisibilitySql(payload.id);
    const rows = await query(`${REEL_SELECT} WHERE r.id IN (${ids.map(() => '?').join(', ')}) AND ${vis.clause}`, [...ids, ...vis.params]);
    const hydrated = await hydrateReels(rows, payload.id);
    const byId = Object.fromEntries(hydrated.map((reel) => [reel.id, reel]));
    const ordered = ids.map((id) => byId[id]).filter(Boolean);
    return res.status(200).json({ success: true, reels: ordered, hasMore: false });
  }

  return res.status(422).json({ success: false, message: 'Mode invalide' });
}

async function handlePost(req, res, payload) {
  const { fields, files } = await parseUpload(req, REEL_VIDEO_TYPES, { maxFileSize: REEL_MAX_FILE_BYTES });

  if (files.length === 0) {
    return res.status(422).json({ success: false, message: 'Une video est requise' });
  }
  const file = files[0];
  if (!file.mimetype.startsWith('video/')) {
    return res.status(422).json({ success: false, message: 'Le fichier doit etre une video' });
  }

  const caption = getField(fields, 'caption').toString().trim().slice(0, 500) || null;
  const visibility = getField(fields, 'visibility', 'public').toString();
  if (!VISIBILITIES.includes(visibility)) {
    return res.status(422).json({ success: false, message: 'Visibilite invalide' });
  }

  const durationSec = Number(getField(fields, 'durationSec', '0'));
  if (Number.isFinite(durationSec) && durationSec > REEL_MAX_DURATION_SEC + 1) {
    return res.status(422).json({ success: false, message: `Un reel dure ${REEL_MAX_DURATION_SEC / 60} minutes maximum` });
  }

  const mediaId = await saveMediaFile(file, payload.id);
  const result = await query('INSERT INTO reel (userId, mediaId, caption, visibility, durationSec) VALUES (?, ?, ?, ?, ?)', [
    payload.id,
    mediaId,
    caption,
    visibility,
    Number.isFinite(durationSec) && durationSec > 0 ? Math.min(durationSec, 9999).toFixed(2) : null
  ]);
  const reelId = result.insertId;
  await syncReelHashtags(reelId, caption);

  const rows = await query(`${REEL_SELECT} WHERE r.id = ? LIMIT 1`, [reelId]);
  const [reel] = await hydrateReels(rows, payload.id);

  await logActivity(payload.id, 'reel_create', {
    targetType: 'reel',
    targetId: reelId,
    meta: { snippet: snippet(caption), visibility }
  });

  return res.status(201).json({ success: true, reel });
}

export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  try {
    if (req.method === 'GET') return await handleGet(req, res, payload);
    if (req.method === 'POST') return await handlePost(req, res, payload);
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  } catch (error) {
    const status = req.method === 'POST' ? 422 : 500;
    return res.status(status).json({ success: false, message: req.method === 'POST' ? error.message || 'Erreur lors de la creation' : 'Erreur serveur' });
  }
}
