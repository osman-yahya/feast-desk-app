// Service worker: adds bypass-tunnel-reminder header to all same-origin requests.
// This ensures the localtunnel reminder page is skipped on return visits.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  const modifiedHeaders = new Headers(event.request.headers)
  modifiedHeaders.set('bypass-tunnel-reminder', 'true')

  const modifiedRequest = new Request(event.request, {
    headers: modifiedHeaders
  })

  event.respondWith(fetch(modifiedRequest))
})

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})
