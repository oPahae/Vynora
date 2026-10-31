import { APP_NAME } from '@/lib/constants';
import { tr } from '@/lib/i18n/server';

// Envoi d'emails via l'API HTTP externe (GET avec parametres dans l'URL).
// L'URL de base peut etre changee avec la variable d'environnement MAIL_API_URL.
const DEFAULT_MAIL_API_URL = 'https://pahae-utils.vercel.app/api/mail';
const MAIL_TIMEOUT_MS = 10000;

export async function sendMail({ to, subject, text, html }) {
  const baseUrl = process.env.MAIL_API_URL || DEFAULT_MAIL_API_URL;
  const params = { email: to, subject, text, html };

  // encodeURIComponent (et non URLSearchParams) : les espaces sont encodes en
  // %20 plutot qu'en "+", ce qui evite tout doute cote API.
  const queryString = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  const separator = baseUrl.includes('?') ? '&' : '?';

  const response = await fetch(`${baseUrl}${separator}${queryString}`, {
    method: 'GET',
    signal: AbortSignal.timeout(MAIL_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`Mail API HTTP ${response.status}`);
  }

  // La forme exacte de la reponse n'est pas garantie : on ne considere l'envoi
  // comme echoue que si l'API l'indique explicitement dans un corps JSON.
  const body = await response.text();
  try {
    const json = JSON.parse(body);
    if (json && (json.success === false || json.error)) {
      throw new Error(`Mail API error: ${json.error || json.message || 'echec'}`);
    }
  } catch (error) {
    if (error instanceof SyntaxError) return;
    throw error;
  }
}

function wrapHtml({ name, intro, code, expiresInMinutes, locale }) {
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  return (
    `<div dir="${dir}" style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;color:#1e293b">` +
    `<h2 style="margin:0 0 12px;color:#4548D9">${APP_NAME}</h2>` +
    `<p>${tr(locale, 'Bonjour{name},', { name })}</p>` +
    `<p>${intro}</p>` +
    `<p style="font-size:32px;font-weight:700;letter-spacing:8px;background:#F1F1FE;color:#3638B0;` +
    `padding:14px;text-align:center;border-radius:12px;margin:16px 0" dir="ltr">${code}</p>` +
    `<p style="font-size:13px;color:#64748b">${tr(locale, 'Ce code expire dans {minutes} minutes.', { minutes: expiresInMinutes })} ` +
    `${tr(locale, "Si vous n'etes pas a l'origine de cette demande, ignorez simplement cet email.")}</p></div>`
  );
}

export function buildPasswordResetEmail({ firstName, code, expiresInMinutes, locale }) {
  const name = firstName ? ` ${firstName}` : '';
  const subject = tr(locale, '{app} - Votre code de reinitialisation', { app: APP_NAME });
  const text = tr(
    locale,
    "Bonjour{name}, votre code de reinitialisation {app} est : {code}. Il expire dans {minutes} minutes. Si vous n'etes pas a l'origine de cette demande, ignorez ce message.",
    { name, app: APP_NAME, code, minutes: expiresInMinutes }
  );
  const html = wrapHtml({
    name,
    intro: tr(locale, 'Voici votre code pour reinitialiser votre mot de passe :'),
    code,
    expiresInMinutes,
    locale
  });
  return { subject, text, html };
}

// Email de verification d'adresse (inscription ou changement d'email).
export function buildEmailVerificationEmail({ firstName, code, expiresInMinutes, purpose, locale }) {
  const name = firstName ? ` ${firstName}` : '';
  const isRegister = purpose === 'register';
  const subject = tr(locale, '{app} - Votre code de verification', { app: APP_NAME });
  const intro = isRegister
    ? tr(locale, 'Bienvenue sur {app} ! Voici votre code pour verifier votre adresse email :', { app: APP_NAME })
    : tr(locale, 'Voici votre code pour confirmer votre nouvelle adresse email :');
  const text = tr(
    locale,
    "Bonjour{name}, {intro} {code}. Il expire dans {minutes} minutes. Si vous n'etes pas a l'origine de cette demande, ignorez ce message.",
    { name, intro, code, minutes: expiresInMinutes }
  );
  const html = wrapHtml({ name, intro, code, expiresInMinutes, locale });
  return { subject, text, html };
}
