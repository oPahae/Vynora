import { query } from './db';

// Parametres globaux modifiables par l'administrateur (table appSetting).
// Les valeurs par defaut s'appliquent tant qu'aucune valeur n'est enregistree.
export const SETTING_DEFAULTS = {
  premium_price_mad: '49', // prix affiche, en dirhams
  premium_charge_currency: 'USD', // PayPal ne supporte pas le MAD : devise reellement facturee
  premium_mad_rate: '0.10', // 1 MAD = x devise de facturation (a ajuster selon le cours)
  premium_duration_days: '30', // duree d'un achat ; 0 = a vie
  boost_hours: '48', // duree d'un boost de publication
  boost_max_active: '3' // boosts simultanes par utilisateur premium
};

const TTL_MS = 10 * 1000;
let cache = null;

export function invalidateSettings() {
  cache = null;
}

export async function getSettings() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.values;
  const rows = await query('SELECT settingKey, settingValue FROM appSetting');
  const values = { ...SETTING_DEFAULTS };
  rows.forEach((row) => {
    if (row.settingKey in SETTING_DEFAULTS) values[row.settingKey] = row.settingValue;
  });
  cache = { at: Date.now(), values };
  return values;
}

// Valide et enregistre une partie des parametres. Renvoie { success, message }.
export async function updateSettings(input) {
  const updates = {};

  if (input.premium_price_mad !== undefined) {
    const price = Number(input.premium_price_mad);
    if (!Number.isFinite(price) || price < 1 || price > 100000) return { success: false, message: 'Prix invalide (1 a 100000 MAD)' };
    updates.premium_price_mad = String(Math.round(price * 100) / 100);
  }
  if (input.premium_charge_currency !== undefined) {
    const currency = String(input.premium_charge_currency).toUpperCase();
    if (!['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF'].includes(currency)) return { success: false, message: 'Devise PayPal non supportee' };
    updates.premium_charge_currency = currency;
  }
  if (input.premium_mad_rate !== undefined) {
    const rate = Number(input.premium_mad_rate);
    if (!Number.isFinite(rate) || rate <= 0 || rate > 100) return { success: false, message: 'Taux de change invalide' };
    updates.premium_mad_rate = String(rate);
  }
  if (input.premium_duration_days !== undefined) {
    const days = Number(input.premium_duration_days);
    if (!Number.isInteger(days) || days < 0 || days > 3650) return { success: false, message: 'Duree invalide (0 a 3650 jours)' };
    updates.premium_duration_days = String(days);
  }
  if (input.boost_hours !== undefined) {
    const hours = Number(input.boost_hours);
    if (!Number.isInteger(hours) || hours < 1 || hours > 720) return { success: false, message: 'Duree de boost invalide (1 a 720 h)' };
    updates.boost_hours = String(hours);
  }
  if (input.boost_max_active !== undefined) {
    const max = Number(input.boost_max_active);
    if (!Number.isInteger(max) || max < 1 || max > 50) return { success: false, message: 'Nombre de boosts invalide (1 a 50)' };
    updates.boost_max_active = String(max);
  }

  const entries = Object.entries(updates);
  if (entries.length === 0) return { success: false, message: 'Aucun parametre a modifier' };
  for (const [key, value] of entries) {
    // eslint-disable-next-line no-await-in-loop
    await query(
      'INSERT INTO appSetting (settingKey, settingValue) VALUES (?, ?) ON DUPLICATE KEY UPDATE settingValue = VALUES(settingValue)',
      [key, value]
    );
  }
  invalidateSettings();
  return { success: true };
}
