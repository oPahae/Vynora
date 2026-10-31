// Service Worker dedie aux notifications push (Web Push).
// Reste volontairement minimal : ce projet n'a pas de strategie de cache
// offline existante, ce fichier ne fait donc qu'ecouter les evenements
// 'push' et 'notificationclick', sans intercepter les requetes reseau
// (pas de `fetch` handler), pour ne rien changer au comportement normal
// de chargement des pages.

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (error) {
    payload = { title: 'Nexus', body: event.data.text() };
  }

  const title = payload.title || 'Nexus';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon.png',
    badge: '/icon.png',
    data: { url: payload.url || '/' },
    tag: payload.tag || undefined
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
