import crypto from 'crypto';

// Client PayPal minimal (API Orders v2), cote serveur uniquement : les montants
// sont toujours decides par le serveur, jamais par le navigateur.
//
// Variables d'environnement :
//   PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET : identifiants de l'application PayPal
//   PAYPAL_MODE = sandbox (defaut) | live | mock
//     mock : simule PayPal sans reseau, UNIQUEMENT hors production (tests locaux).

export function getPaypalMode() {
  const mode = (process.env.PAYPAL_MODE || 'sandbox').toLowerCase();
  if (mode === 'mock' && process.env.NODE_ENV === 'production') return 'sandbox';
  return ['live', 'mock'].includes(mode) ? mode : 'sandbox';
}

export function isPaypalConfigured() {
  return getPaypalMode() === 'mock' || Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

function baseUrl() {
  return getPaypalMode() === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

async function getAccessToken() {
  const credentials = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const response = await fetch(`${baseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`PayPal auth HTTP ${response.status}`);
  const data = await response.json();
  return data.access_token;
}

// amount : chaine "4.90" ; currency : "USD"...
export async function createOrder({ amount, currency, description, customId }) {
  if (getPaypalMode() === 'mock') return { id: `MOCK-${crypto.randomBytes(8).toString('hex')}` };

  const token = await getAccessToken();
  const response = await fetch(`${baseUrl()}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{ description, custom_id: customId, amount: { currency_code: currency, value: amount } }]
    }),
    signal: AbortSignal.timeout(15000)
  });
  const data = await response.json();
  if (!response.ok || !data.id) throw new Error(`PayPal create order HTTP ${response.status}`);
  return { id: data.id };
}

// Capture une commande approuvee par l'acheteur. Renvoie les donnees utiles a
// la verification (statut, montant, devise, identifiant de capture, email).
export async function captureOrder(orderId, expected) {
  if (getPaypalMode() === 'mock') {
    return {
      status: 'COMPLETED',
      amount: expected.amount,
      currency: expected.currency,
      captureId: `MOCKCAP-${crypto.randomBytes(6).toString('hex')}`,
      payerEmail: 'sandbox-buyer@example.com'
    };
  }

  const token = await getAccessToken();
  const response = await fetch(`${baseUrl()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(20000)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`PayPal capture HTTP ${response.status}`);

  const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
  return {
    status: capture ? capture.status : data.status,
    amount: capture?.amount?.value,
    currency: capture?.amount?.currency_code,
    captureId: capture?.id || null,
    payerEmail: data.payer?.email_address || null
  };
}
