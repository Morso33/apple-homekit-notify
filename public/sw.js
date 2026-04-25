// Service Worker for homekit-notify

self.addEventListener('push', (event) => {
  let data = { title: 'HomeKit Alert', body: 'A HomeKit automation was triggered.' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icon.png',
    badge: '/badge.png',
    vibrate: [200, 100, 200],
    data: { url: self.registration.scope },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url || '/'));
});
