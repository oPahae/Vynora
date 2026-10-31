import { query } from '@/lib/db';
import { logActivity, snippet } from '@/lib/activity';
import { comparePassword, signToken, buildAuthCookie } from '@/lib/auth';
import { validateLoginInput } from '@/lib/validators';
import { mediaUrl } from '@/lib/upload';
import { isRecaptchaEnabled, verifyRecaptcha } from '@/lib/recaptcha';
import { getClientIp } from '@/lib/rateLimit';
import { readDeviceCookie, newDeviceId, buildDeviceCookie, recordLoginDevice } from '@/lib/devices';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const { isValid, errors, data } = validateLoginInput(req.body || {});
  if (!isValid) {
    return res.status(422).json({ success: false, message: 'Donnees invalides', errors });
  }

  if (isRecaptchaEnabled()) {
    const captchaToken = req.body?.captchaToken;
    if (!captchaToken) {
      return res.status(422).json({
        success: false,
        message: 'Veuillez valider le captcha',
        errors: { captcha: 'Veuillez valider le captcha' }
      });
    }

    try {
      const captcha = await verifyRecaptcha(captchaToken, getClientIp(req));
      if (!captcha.success) {
        console.warn('reCAPTCHA refuse :', captcha.reason);
        return res.status(422).json({
          success: false,
          message: 'Verification captcha echouee, veuillez reessayer',
          errors: { captcha: 'Verification captcha echouee, veuillez reessayer' }
        });
      }
    } catch (error) {
      console.error('Verification reCAPTCHA impossible :', error);
      return res.status(503).json({
        success: false,
        message: 'Verification captcha indisponible, veuillez reessayer'
      });
    }
  }

  try {
    const rows = await query(
      'SELECT id, firstName, lastName, email, password, avatarId, coverId, language, deactivatedAt, role, bannedAt, banReason FROM user WHERE email = ? LIMIT 1',
      [data.email]
    );

    if (rows.length === 0) {
      // Compte supprime par l'administration : on affiche le motif saisi.
      const deleted = await query('SELECT reason FROM deletedAccount WHERE email = ? LIMIT 1', [data.email]);
      if (deleted[0]) {
        return res.status(403).json({
          success: false,
          deleted: true,
          reason: deleted[0].reason,
          message: deleted[0].reason
            ? `Ce compte a ete supprime par l'administration. Motif : ${deleted[0].reason}`
            : "Ce compte a ete supprime par l'administration."
        });
      }
      return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect' });
    }

    const user = rows[0];
    const passwordMatches = await comparePassword(data.password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect' });
    }

    if (user.bannedAt) {
      return res.status(403).json({
        success: false,
        banned: true,
        reason: user.banReason || null,
        message: user.banReason
          ? `Ce compte a ete suspendu par l'administration. Motif : ${user.banReason}`
          : "Ce compte a ete suspendu par l'administration."
      });
    }

    // Se reconnecter avec le bon mot de passe reactive automatiquement un
    // compte desactive (comme Facebook/Instagram), pas besoin d'ecran a part.
    const wasDeactivated = Boolean(user.deactivatedAt);

    const token = await signToken({ id: user.id, email: user.email });
    await query('UPDATE user SET lastSeenAt = NOW(), deactivatedAt = NULL WHERE id = ?', [user.id]);

    await logActivity(user.id, 'login', { meta: { ip: getClientIp(req) } });

    // Identifiant d'appareil (cookie long) : sert a detecter un nouvel appareil.
    const deviceId = readDeviceCookie(req) || newDeviceId();
    res.setHeader('Set-Cookie', [buildAuthCookie(token), buildDeviceCookie(deviceId)]);
    // Enregistrement + alerte "nouvel appareil" apres la reponse (geolocalisation
    // et email ne doivent pas ralentir la connexion).
    res.on('finish', () => {
      recordLoginDevice({ user, req, deviceId });
    });
    return res.status(200).json({
      success: true,
      message: wasDeactivated ? 'Votre compte a ete reactive' : 'Connexion reussie',
      reactivated: wasDeactivated,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        avatar: mediaUrl(user.avatarId),
        cover: mediaUrl(user.coverId),
        language: user.language || null,
        role: user.role
      }
    });
  } catch (error) {
    console.log(error)
    return res.status(500).json({ success: false, message: 'Erreur serveur, veuillez reessayer' });
  }
}
