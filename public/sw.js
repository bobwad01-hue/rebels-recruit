self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'RLTNL Recruiting';
  const options = {
    body: data.body || 'You have a new recruiting update.',
    tag: data.kind === 'coach_email' && data.data?.gmail_recruiting_message_id ? 'coach-email-' + data.data.gmail_recruiting_message_id : (data.kind || 'rltnl-recruiting'),
    renotify: true,
    data: { url: data.url || '/dashboard', ...(data.data || {}) }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification?.data?.url || '/dashboard';
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) await client.navigate(url);
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
