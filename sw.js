/* 一凡工作台 · Service Worker：离线可用 + 页面优先取最新 */
const CACHE = "yifan-workbench-v11";
const ASSETS = [
  "./",
  "./index.html",
  "./data.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* 页面本身用 network-first：有网就拿最新版，断网才用缓存 */
function isPage(req){
  return req.mode === "navigate"
    || (req.headers.get("accept") || "").indexOf("text/html") > -1
    || req.url.endsWith("/");
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  // 跨域资源（如 OCR 引擎 CDN、SDK）不拦截，直接放行
  try{
    if (new URL(req.url).origin !== self.location.origin) return;
  }catch(err){ return; }

  if (isPage(req)) {
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match("./index.html")))
    );
    return;
  }

  // 静态资源：先用缓存，后台更新
  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) {
        fetch(req).then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE).then(c => c.put(req, res.clone()));
          }
        }).catch(() => {});
        return hit;
      }
      return fetch(req).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match("./index.html"));
    })
  );
});
