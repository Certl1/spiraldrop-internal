// 让 GitHub Pages 也能「压缩传输」：浏览器请求 index.wasm 时，
// 这里改成去拉 index.wasm.gz 并在本地解压，传输量从 37.7MB 降到 9.6MB。
// 任何一步失败都回退到原始请求，不会把游戏搞挂。
const GZ_PATH = 'index.wasm.gz';

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
      const res = await fetch(GZ_PATH, { cache: 'force-cache' });
      if (!res.ok || !res.body) {
        return fetch(event.request);
      }
      const stream = res.body.pipeThrough(new DecompressionStream('gzip'));
      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'application/wasm',
          'Content-Length': String(39514754),
        },
      });
    } catch (err) {
      console.warn('[sw] gzip fallback:', err);
      return fetch(event.request);
    }
  })());
});
