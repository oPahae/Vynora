import { t } from '@/lib/i18n/runtime';
// Convertit une cle VAPID publique (base64 URL-safe) en Uint8Array, format
// attendu par PushManager.subscribe().
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

// Enregistre le Service Worker au chargement de l'app (pas de demande de
// permission ici : seule l'action explicite de l'utilisateur dans les
// parametres declenche la demande d'autorisation navigateur).
export async function registerServiceWorker() {
  if (!isPushSupported()) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (error) {
    console.error('Echec de l\'enregistrement du Service Worker:', error);
    return null;
  }
}

export async function getCurrentSubscription() {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function subscribeToPush(vapidPublicKey) {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
  });

  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: subscription.toJSON() })
  });
  const data = await response.json();
  if (!data.success) {
    // Le serveur n'a pas pu enregistrer l'abonnement : on annule
    // l'abonnement navigateur pour ne pas laisser l'etat incoherent.
    await subscription.unsubscribe();
    throw new Error(data.message || t("Erreur lors de l'abonnement"));
  }

  return subscription;
}

export async function unsubscribeFromPush() {
  const subscription = await getCurrentSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await fetch('/api/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint })
  });
}
