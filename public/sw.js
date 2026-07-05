// Neuro Report — minimal service worker
// 정적 자산은 stale-while-revalidate, 동적 페이지/API는 항상 네트워크 우선
// 환자 데이터는 절대 캐시하지 않음 (의료정보 보안)

const CACHE_NAME = 'neuro-report-v1';
const STATIC_ASSETS = ['/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // API 요청, Supabase 호출, 페이지 요청은 항상 네트워크
  if (
    url.pathname.startsWith('/api/') ||
    url.host.includes('supabase.co') ||
    url.pathname.endsWith('.json') === false && url.pathname.indexOf('.') === -1
  ) {
    return; // 네트워크로 그냥 보냄 (캐시 안 함)
  }

  // 정적 자산만 캐시 우선
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((res) => {
        if (res.ok && req.url.startsWith(self.location.origin)) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone));
        }
        return res;
      });
      return cached ?? fetchPromise;
    }),
  );
});
