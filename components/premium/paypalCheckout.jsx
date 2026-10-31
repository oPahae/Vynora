import { useEffect, useRef, useState } from 'react';
import { Loader2, FlaskConical } from 'lucide-react';
import { t, td } from '@/lib/i18n/runtime';

function loadPaypalSdk(clientId, currency) {
  return new Promise((resolve, reject) => {
    const id = 'paypal-sdk';
    const existing = document.getElementById(id);
    if (existing && window.paypal && existing.dataset.currency === currency) {
      resolve(window.paypal);
      return;
    }
    if (existing) existing.remove();
    const script = document.createElement('script');
    script.id = id;
    script.dataset.currency = currency;
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}&intent=capture`;
    script.onload = () => (window.paypal ? resolve(window.paypal) : reject(new Error('PayPal SDK')));
    script.onerror = () => reject(new Error('PayPal SDK'));
    document.body.appendChild(script);
  });
}

async function postJson(url, body) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  return response.json();
}

// Boutons PayPal. Le montant est fixe par le serveur : le navigateur ne fait
// que demander une commande puis la faire capturer apres approbation.
export default function PaypalCheckout({ config, onPaid }) {
  const containerRef = useRef(null);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isMock = config.paypalMode === 'mock';

  useEffect(() => {
    if (isMock || !config.paypalClientId) {
      setState(isMock ? 'ready' : 'error');
      return undefined;
    }
    let cancelled = false;
    loadPaypalSdk(config.paypalClientId, config.chargeCurrency)
      .then((paypal) => {
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = '';
        paypal
          .Buttons({
            style: { layout: 'vertical', shape: 'pill', label: 'pay' },
            createOrder: async () => {
              const data = await postJson('/api/premium/order');
              if (!data.success) throw new Error(td(data.message) || t("Une erreur est survenue"));
              return data.orderId;
            },
            onApprove: async (data) => {
              const result = await postJson('/api/premium/capture', { orderId: data.orderID });
              if (result.success) onPaid(result.status);
              else setError(td(result.message) || t("Paiement non valide"));
            },
            onError: () => setError(t("Le paiement a echoue. Reessayez."))
          })
          .render(containerRef.current);
        setState('ready');
      })
      .catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
    };
  }, [config.paypalClientId, config.chargeCurrency, isMock, onPaid]);

  // Mode test (PAYPAL_MODE=mock, jamais en production) : simule l'approbation.
  async function simulate() {
    setBusy(true);
    setError('');
    try {
      const order = await postJson('/api/premium/order');
      if (!order.success) throw new Error(td(order.message));
      const result = await postJson('/api/premium/capture', { orderId: order.orderId });
      if (result.success) onPaid(result.status);
      else setError(td(result.message));
    } catch (err) {
      setError(err.message || t("Une erreur est survenue"));
    } finally {
      setBusy(false);
    }
  }

  if (!config.paypalConfigured) {
    return <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl2 px-4 py-3">{t("Le paiement n'est pas encore configure par l'administrateur.")}</p>;
  }

  return (
    <div className="space-y-3">
      {isMock ? (
        <button onClick={simulate} disabled={busy} className="nx-btn-secondary w-full h-12">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <FlaskConical size={16} />} {t("Simuler le paiement (mode test)")}
        </button>
      ) : (
        <>
          {state === 'loading' && <div className="flex justify-center py-4"><Loader2 className="animate-spin text-brand-400" /></div>}
          {state === 'error' && <p className="text-sm text-red-500">{t("Impossible de charger PayPal. Verifiez votre connexion.")}</p>}
          <div ref={containerRef} />
        </>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
