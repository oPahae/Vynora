import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { withProfileUrls } from '@/lib/upload';
import SOCIAL_LINKS from '@/components/shared/socialLinksConfig';

function sanitize(value, maxLength) {
  return (value || '').toString().trim().slice(0, maxLength);
}

function sanitizeSocialLinks(input) {
  const result = {};
  if (!input || typeof input !== 'object') return result;
  SOCIAL_LINKS.forEach(({ key }) => {
    const raw = sanitize(input[key], 300);
    if (!raw) return;
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    result[key] = withScheme;
  });
  return result;
}

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const body = req.body || {};
  const firstName = sanitize(body.firstName, 50);
  const lastName = sanitize(body.lastName, 50);
  const bio = sanitize(body.bio, 500);
  const work = sanitize(body.work, 150);
  const education = sanitize(body.education, 150);
  const city = sanitize(body.city, 100);
  const country = sanitize(body.country, 100);
  const phone = sanitize(body.phone, 30);
  const socialLinks = sanitizeSocialLinks(body.socialLinks);
  const genderRaw = sanitize(body.gender, 10);
  const gender = genderRaw === 'male' || genderRaw === 'female' ? genderRaw : null;
  const birthDateRaw = sanitize(body.birthDate, 10);
  let birthDate = null;
  if (birthDateRaw) {
    const parsed = new Date(birthDateRaw);
    if (!Number.isNaN(parsed.getTime()) && parsed <= new Date()) {
      birthDate = birthDateRaw;
    }
  }

  if (firstName.length < 2 || lastName.length < 2) {
    return res.status(422).json({ success: false, message: 'Le prenom et le nom sont requis' });
  }

  try {
    await query(
      `UPDATE user
       SET firstName = ?, lastName = ?, bio = ?, work = ?, education = ?, city = ?, country = ?, phone = ?,
           socialLinks = ?, gender = ?, birthDate = ?
       WHERE id = ?`,
      [firstName, lastName, bio, work, education, city, country, phone, JSON.stringify(socialLinks), gender, birthDate, payload.id]
    );

    const rows = await query(
      `SELECT id, firstName, lastName, email, avatarId, coverId, bio, work, education, city, country, phone,
              gender, birthDate, theme, isPrivate, socialLinks, musicMediaId, musicTitle, musicStartSec, musicEndSec
       FROM user WHERE id = ? LIMIT 1`,
      [payload.id]
    );

    const user = {
      ...withProfileUrls(rows[0]),
      musicStartSec: rows[0].musicStartSec !== null ? Number(rows[0].musicStartSec) : 0,
      musicEndSec: rows[0].musicEndSec !== null ? Number(rows[0].musicEndSec) : null
    };

    return res.status(200).json({ success: true, user });
  } catch (error) {
    console.log(error)
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
