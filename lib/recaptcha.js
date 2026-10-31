// Verification cote serveur d'un jeton Google reCAPTCHA (v2 case a cocher).
// Le captcha est actif des que RECAPTCHA_SECRET_KEY est definie.
const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

export function isRecaptchaEnabled() {
  return Boolean(process.env.RECAPTCHA_SECRET_KEY);
}

export async function verifyRecaptcha(token, remoteIp) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return { success: true, skipped: true };
  if (!token || typeof token !== 'string') return { success: false, reason: 'missing-input-response' };

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp && remoteIp !== 'unknown') body.set('remoteip', remoteIp);

  const response = await fetch(VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    throw new Error(`reCAPTCHA HTTP ${response.status}`);
  }

  const data = await response.json();
  return {
    success: data.success === true,
    reason: Array.isArray(data['error-codes']) ? data['error-codes'].join(',') : undefined
  };
}
