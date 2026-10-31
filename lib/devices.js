import crypto from 'crypto';
import { query } from './db';
import { locateIp, normalizeIp, formatLocation } from './geo';
import { createNotification } from './notifications';
import { sendMail } from './mailer';
import { APP_NAME } from './constants';
import { tr } from './i18n/server';

export const DEVICE_COOKIE = 'nx_device';
const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 730; // 2 ans

export function newDeviceId() {
  return crypto.randomBytes(24).toString('hex');
}

export function readDeviceCookie(req) {
  const value = req.cookies ? req.cookies[DEVICE_COOKIE] : null;
  return typeof value === 'string' && /^[a-f0-9]{48}$/.test(value) ? value : null;
}

export function buildDeviceCookie(deviceId) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${DEVICE_COOKIE}=${deviceId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DEVICE_COOKIE_MAX_AGE}${secure}`;
}

function deviceKeyOf(deviceId) {
  return crypto.createHash('sha256').update(deviceId).digest('hex');
}

// "Chrome sur Windows", "Safari sur iPhone"...
export function describeUserAgent(userAgent = '') {
  const ua = String(userAgent);
  let os = 'appareil inconnu';
  if (/iPhone/i.test(ua)) os = 'iPhone';
  else if (/iPad/i.test(ua)) os = 'iPad';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/CrOS/i.test(ua)) os = 'ChromeOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Navigateur';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Internet';
  else if (/Firefox|FxiOS/i.test(ua)) browser = 'Firefox';
  else if (/Chrome|CriOS/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua)) browser = 'Safari';

  return { browser, os, label: `${browser} · ${os}` };
}

function emailHtml({ locale, name, device, place, ip, when }) {
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  return (
    `<div dir="${dir}" style="font-family:Arial,sans-serif;max-width:460px;margin:auto;padding:24px;color:#1e293b">` +
    `<h2 style="margin:0 0 12px;color:#4548D9">${APP_NAME}</h2>` +
    `<p>${tr(locale, 'Bonjour{name},', { name: name ? ` ${name}` : '' })}</p>` +
    `<p>${tr(locale, 'Nous avons detecte une connexion a votre compte depuis un nouvel appareil.')}</p>` +
    `<table style="border-collapse:collapse;margin:12px 0;font-size:14px">` +
    `<tr><td style="padding:4px 12px 4px 0;color:#64748b">${tr(locale, 'Appareil')}</td><td><b>${device}</b></td></tr>` +
    `<tr><td style="padding:4px 12px 4px 0;color:#64748b">${tr(locale, 'Localisation')}</td><td><b>${place}</b></td></tr>` +
    `<tr><td style="padding:4px 12px 4px 0;color:#64748b">IP</td><td><b dir="ltr">${ip}</b></td></tr>` +
    `<tr><td style="padding:4px 12px 4px 0;color:#64748b">${tr(locale, 'Date')}</td><td><b>${when}</b></td></tr></table>` +
    `<p style="font-size:13px;color:#64748b">${tr(locale, "Si ce n'etait pas vous, changez immediatement votre mot de passe depuis les parametres de votre compte.")}</p></div>`
  );
}

// Enregistre l'appareil de connexion et, s'il est nouveau (alors que le compte
// en connaissait deja au moins un), alerte l'utilisateur : notification dans
// l'application (+ push) et email, avec la localisation approximative.
// A appeler APRES avoir repondu a la requete de connexion (fire and forget).
export async function recordLoginDevice({ user, req, deviceId, isFirstDeviceCookie }) {
  try {
    const key = deviceKeyOf(deviceId);
    const ip = normalizeIp(
      (typeof req.headers['x-forwarded-for'] === 'string' && req.headers['x-forwarded-for'].split(',')[0]) ||
        req.socket?.remoteAddress
    );
    const { label, browser, os } = describeUserAgent(req.headers['user-agent']);

    const existing = await query('SELECT id FROM loginDevice WHERE userId = ? AND deviceKey = ? LIMIT 1', [user.id, key]);
    const location = await locateIp(ip, req.headers);

    if (existing[0]) {
      await query(
        'UPDATE loginDevice SET lastSeenAt = NOW(), ip = ?, city = ?, region = ?, country = ?, label = ? WHERE id = ?',
        [ip, location.city, location.region, location.country, label, existing[0].id]
      );
      return;
    }

    const known = await query('SELECT COUNT(*) AS count FROM loginDevice WHERE userId = ?', [user.id]);
    await query(
      'INSERT INTO loginDevice (userId, deviceKey, label, ip, city, region, country) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [user.id, key, label, ip, location.city, location.region, location.country]
    );

    // Premier appareil enregistre (nouveau compte ou compte existant avant cette
    // fonctionnalite) : on memorise sans alerter.
    if (Number(known[0].count) === 0) return;

    const place = formatLocation(location) || (location.local ? 'Reseau local' : 'Localisation inconnue');
    await createNotification({
      userId: user.id,
      actorId: user.id,
      type: 'loginAlert',
      allowSelf: true,
      content: JSON.stringify({ d: label, p: place })
    });

    const locale = user.language || 'fr';
    try {
      await sendMail({
        to: user.email,
        subject: tr(locale, '{app} - Nouvelle connexion a votre compte', { app: APP_NAME }),
        text: tr(locale, 'Nouvelle connexion detectee : {device} - {place} (IP {ip}). Si ce n\'etait pas vous, changez votre mot de passe.', {
          device: label,
          place,
          ip: ip || '?'
        }),
        html: emailHtml({
          locale,
          name: user.firstName,
          device: `${browser} · ${os}`,
          place: place === 'Reseau local' ? tr(locale, 'Reseau local') : place === 'Localisation inconnue' ? tr(locale, 'Localisation inconnue') : place,
          ip: ip || '?',
          when: new Date().toLocaleString(locale === 'ar' ? 'ar' : locale)
        })
      });
    } catch (error) {
      // l'email est un plus ; la notification dans l'application a deja ete creee
    }
  } catch (error) {
    // l'alerte ne doit jamais perturber la connexion
  }
}
