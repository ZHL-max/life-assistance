// Service Worker for Web Push notifications

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data.json()
  } catch {
    data = { title: '今日提醒', body: event.data?.text() || '你有一条新提醒' }
  }

  const title = data.title || '今日提醒'
  const options = {
    body: data.body || '',
    icon: '/pika-icon.svg',
    badge: '/pika-icon.svg',
    tag: data.tag || 'reminder',
    data: { url: data.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          return
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
