// Source of the admin service worker, served at /admin/sw.js.
//
// It does one thing beyond being installable: when Android shares photos to
// the installed app, the share arrives as a POST navigation to /admin/share.
// The worker keeps the files on the phone (Cache API) and opens
// /admin/share/received, and the product form then uploads them with normal
// same-origin requests. This works even when the browser withholds the
// session cookie on the share POST, and the photos survive signing in.
// If anything fails here, the POST goes on to the server route instead.

export const SHARED_CACHE = 'shared-files-v1'
export const SHARED_PREFIX = '/admin/shared/'

export const SERVICE_WORKER_SOURCE = `
const CACHE = ${JSON.stringify(SHARED_CACHE)};
const PREFIX = ${JSON.stringify(SHARED_PREFIX)};
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method === 'POST' && url.origin === self.location.origin && url.pathname === '/admin/share') {
    event.respondWith(receiveShare(req));
  }
  // Everything else goes to the network as usual (no offline caching).
});

async function receiveShare(req) {
  const backup = req.clone();
  try {
    const form = await req.formData();
    const files = form.getAll('files').filter((f) => typeof f !== 'string');
    const id = self.crypto.randomUUID();
    const cache = await caches.open(CACHE);
    await dropOld(cache);
    await Promise.all(files.map((file, i) => cache.put(
      PREFIX + id + '/' + String(i).padStart(3, '0'),
      new Response(file, { headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-File-Name': encodeURIComponent(file.name || 'photo-' + (i + 1)),
        'X-Shared-At': String(Date.now()),
      } })
    )));
    return Response.redirect(new URL('/admin/share/received?id=' + id, self.location.origin).href, 303);
  } catch (err) {
    return fetch(backup);
  }
}

async function dropOld(cache) {
  const now = Date.now();
  for (const key of await cache.keys()) {
    const res = await cache.match(key);
    const at = Number(res && res.headers.get('X-Shared-At'));
    if (!at || now - at > MAX_AGE_MS) await cache.delete(key);
  }
}
`
