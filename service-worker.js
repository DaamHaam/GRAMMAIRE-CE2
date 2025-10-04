const CACHE_NAME = 'grammaire-ce2-cache-v3';
const OFFLINE_URLS = [
  './',
  'index.html',
  'src/styles.css',
  'src/main.js',
  'src/storage.js',
  'data/phrases.json',
  'data/maths.json',
  'changelog.md',
  'public/pictos/subject.svg',
  'public/pictos/verb.svg',
  'public/pictos/group.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(OFFLINE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, clone))
            .catch(() => {});
          return response;
        })
        .catch(() => caches.match('index.html'));
    })
  );
});
