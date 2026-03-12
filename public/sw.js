// Service Worker for GoTop Donuts push notifications

self.addEventListener('push', (event) => {
  let data = { title: 'New Order!', body: 'You have a new order.' };
  try {
    data = event.data.json();
  } catch {
    // use defaults
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/logo-header.png',
      badge: '/logo-header.png',
      tag: 'new-order',
      renotify: true,
      requireInteraction: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing admin tab if open
      for (const client of windowClients) {
        if (client.url.includes('/admin/orders') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new tab
      return clients.openWindow('/admin/orders');
    })
  );
});
