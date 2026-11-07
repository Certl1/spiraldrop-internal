// Service Worker：GitHub Pages 不压缩 .wasm，这里改成拉 gzip 版并本地解压。
// 传输量 37.7MB -> 10MB；任何一步失败都回退到原始请求，不会把游戏搞挂。
const GZ_LOCAL = 'index.wasm.gz';
// 国内直连 GitHub Pages 很慢（10MB 的 gz 能卡到超时），优先走 jsDelivr 的 CDN。
// cdn.jsdelivr.net 在部分网络被重置，fastly.jsdelivr.net 通常可用；两个都试，最后回退本地。
const GZ_CDNS = [
  'https://fastly.jsdelivr.net/gh/Certl1/spiraldrop-internal@main/index.wasm.gz',
  'https://cdn.jsdelivr.net/gh/Certl1/spiraldrop-internal@main/index.wasm.gz',
];
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
        res = await cache.match(GZ_LOCAL);
        if (!res) {
          for (const cdn of GZ_CDNS) {
            try {
              const head = await Promise.race([
                fetch(cdn, { method: 'GET' }),
                new Promise((_, rej) => setTimeout(() => rej(new Error('cdn timeout')), 12000)),
              ]);
              if (head.ok) {
                cache.put(GZ_LOCAL, head.clone()).catch(() => {});
                res = head;
                break;
              }
            } catch (e) {
              console.warn('[sw] cdn failed:', cdn, e);
            }
          }
        }
        if (!res) {
          // 没有超时的话，网络差的环境下这个请求会永远挂着，
          // 页面表现就是进度条卡在 0%、一直"加载不动"。
          const fetched = await Promise.race([
            fetch(GZ_LOCAL),
            new Promise((_, reject) => setTimeout(() => reject(new Error('gz fetch timeout')), 20000)),
          ]);
          if (fetched.ok) {
            cache.put(GZ_LOCAL, fetched.clone()).catch(() => {});
            res = fetched;
          }
        }
      } catch (e) {
        console.warn('[sw] gz unavailable, falling back:', e);
        res = null;
      }
      if (!res || !res.ok || !res.body) {
        res = await fetch(GZ_LOCAL, { cache: 'force-cache' });
      }
      if (!res.ok || !res.body) {
        return fetch(event.request);
      }
      // 一次性读完再解压：逐块 pipeThrough 在手机上吞吐很差（表现为进度条
      // 走一小段就停、半天才动一下）。整块解压是纯内存操作，快得多。
      const compressed = await res.arrayBuffer();
      const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
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
