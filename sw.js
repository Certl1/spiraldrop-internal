// Service Worker：GitHub Pages 不压缩 .wasm，这里改成拉 gzip 版并本地解压。
// 传输量 37.7MB -> 10MB；任何一步失败都回退到原始请求，不会把游戏搞挂。
const GZ_PATH = 'index.wasm.gz';
const WASM_BYTES = 39514754;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.endsWith('/index.wasm')) {
    return;
  }
  event.respondWith((async () => {
    try {
      if (typeof DecompressionStream === 'undefined') {
        return fetch(event.request);
      }
      // 用 Cache API 永久缓存 gz：GitHub Pages 的 HTTP 缓存只有 10 分钟，
      // 过期后又要重下 37.7MB。这里命中一次就存住，以后直接从缓存读。
      let res = null;
      try {
        const cache = await caches.open('spiraldrop-wasm-v1');
        res = await cache.match(GZ_PATH);
        if (!res) {
          const fetched = await fetch(GZ_PATH);
          if (fetched.ok) {
            await cache.put(GZ_PATH, fetched.clone());
            res = fetched;
          }
        }
      } catch (e) {
        res = null;
      }
      if (!res || !res.ok || !res.body) {
        res = await fetch(GZ_PATH, { cache: 'force-cache' });
      }
      if (!res.ok || !res.body) {
        return fetch(event.request);
      }
      const stream = res.body.pipeThrough(new DecompressionStream('gzip'));
      return new Response(stream, {
        status: 200,
        headers: {
          // 不要带 Content-Length：实际 body 是解压流，长度和 WASM_BYTES 一致但
          // 浏览器可能据此等待过多数据；让运行时自己判断长度。
          'Content-Type': 'application/wasm',
        },
      });
    } catch (err) {
      console.warn('[sw] gzip fallback:', err);
      return fetch(event.request);
    }
  })());
});
