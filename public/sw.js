// Service worker: makes the app installable and shows Web Push notifications sent by `send-push`.
// Payload: { id, kind, title, body, url, unread }

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }

  const tasks = [
    self.registration.showNotification(data.title || 'Cricademy', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      tag: data.id,
      data: { id: data.id, url: data.url || '/' },
    }),
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => list.forEach((c) => c.postMessage({ type: 'notification:received', id: data.id }))),
  ]
  if (typeof data.unread === 'number' && navigator.setAppBadge) tasks.push(navigator.setAppBadge(data.unread).catch(() => {}))
  event.waitUntil(Promise.all(tasks))
})

// Focuses an open window and lets the app route there; opens a new one otherwise.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const { id, url = '/' } = event.notification.data || {}
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const client = list.find((c) => 'focus' in c)
      if (client) {
        client.postMessage({ type: 'notification:open', id, url })
        return client.focus()
      }
      return self.clients.openWindow(new URL(url, self.location.origin).href)
    }),
  )
})
