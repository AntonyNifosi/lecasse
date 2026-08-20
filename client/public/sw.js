const CACHE_NAME = 'le-casse-shell-v4';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/socket.io')) return; // never intercept realtime traffic

  // Network-first: a stale shell is a wrong shell, not a fast one - the deploy that keeps
  // shipping it, and the room codes and game state it'd be showing, are only ever a page
  // load old. Cache-first served whatever load first cached, however many deploys behind
  // that got, since the refetch it kicked off in the background only ever paid off the
  // load *after* the one that needed it. This still falls back to that cache, but only once
  // the network has actually failed - offline is the one time a stale shell beats none.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        return response;
      })
      .catch(() => caches.match(request)),
  );
});
