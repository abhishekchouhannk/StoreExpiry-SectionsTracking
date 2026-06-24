// ═════════════════════════════════════════════════════════
//  SERVICE WORKER — Push Notification Handler
// ═════════════════════════════════════════════════════════
// Received a push message from the server
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Expiry Alert', body: event.data ? event.data.text() : 'Check expiry items!' };
  }
  const options = {
    body:      data.body      || 'You have items that need attention.',
    icon:      data.icon      || '/icons/icon-192.png',
    badge:     data.badge     || '/icons/badge-72.png',
    tag:       data.tag       || 'expiry-alert',      // groups/replaces same tag
    renotify:  true,                                   // vibrate even if same tag
    vibrate:   [300, 100, 300, 100, 300],              // strong attention pattern
    requireInteraction: true,                          // don't auto-dismiss — stays until tapped
    timestamp: data.timestamp || Date.now(),
    data: {
      url:    data.url    || '/',
      siteId: data.data?.siteId || null,
    },
    actions: [
      { action: 'view',    title: '📋 View Items' },
      { action: 'dismiss', title: '✕ Dismiss'     },
    ],
  };
  event.waitUntil(
    self.registration.showNotification(
      data.title || '⚠️ Expiry Alert',
      options
    )
  );
});
// User tapped the notification or an action button
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  // Open the app / bring existing tab to front
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a tab with the app is already open, focus it
      for (const client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new tab
      return clients.openWindow(targetUrl);
    })
  );
});
// Keep service worker alive
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});