self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Reminder', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/badge.png',
      tag: data.tag,
      requireInteraction: true, // stays until tapped — good for a store tablet
      data: { url: data.url || '/' }
    })
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});