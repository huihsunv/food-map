// 美食地圖 Service Worker
// 每次要發佈新版時，把下面的版本號 +1（例如 v1 -> v2），
// 使用者就會收到「有新版本」的更新提示。
const VERSION = 'v6';
const CACHE = `foodmap-${VERSION}`;

// App 外殼：離線時仍可開啟
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

// 安裝：預先快取 App 外殼
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(APP_SHELL))
  );
});

// 啟用：清掉舊版本快取
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// 收到頁面指令時立即接手（使用者按下「立即更新」）
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // 只處理 GET；POST（Places / Gemini / Firestore 寫入）一律走網路
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 跨網域資源（Firebase SDK、Google API、字型 CDN）交給網路，不攔截
  if (url.origin !== location.origin) return;

  // 網頁 / HTML：優先走網路，確保線上使用者永遠拿到最新版；
  // 沒網路時才用快取備援
  const isNavigation = req.mode === 'navigate'
    || url.pathname.endsWith('.html')
    || url.pathname.endsWith('/');

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // 其他同網域靜態資源（圖示、manifest）：優先用快取，加快載入
  event.respondWith(
    caches.match(req).then(cached =>
      cached || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      })
    )
  );
});
