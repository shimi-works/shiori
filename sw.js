/* 栞 Shiori — Service Worker
   ・アプリ本体はネット優先（更新を取り込みつつ、オフライン時はキャッシュ）
   ・青空文庫の本文(GitHub raw)は cache-first（一度読めば以後オフラインでも読める）
   ・辞書/Wikipedia/Gemini/kuromoji はネット優先
*/
const CACHE = "shiori-v3";
const SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e)=>{
  e.waitUntil(
    caches.open(CACHE).then(c=> c.addAll(SHELL).catch(()=>{}) ).then(()=> self.skipWaiting())
  );
});
self.addEventListener("activate", (e)=>{
  e.waitUntil(
    caches.keys().then(ks=> Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=> self.clients.claim())
  );
});
self.addEventListener("fetch", (e)=>{
  const req = e.request;
  if(req.method !== "GET") return;
  let url; try{ url = new URL(req.url); }catch(_){ return; }

  // アプリ本体（同一オリジン）
  if(url.origin === location.origin){
    const isDoc = req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("index.html");
    if(isDoc){
      // ネット優先（HTTPキャッシュを迂回して常に最新を取得）→ 失敗時キャッシュ
      e.respondWith(
        fetch(req, {cache:"reload"}).then(r=>{ const cp=r.clone(); caches.open(CACHE).then(c=>c.put("./index.html", cp)); return r; })
                  .catch(()=> caches.match("./index.html").then(r=> r || caches.match("./")))
      );
    } else {
      // アイコン等：キャッシュ優先
      e.respondWith(caches.match(req).then(r=> r || fetch(req)));
    }
    return;
  }

  // 青空文庫の本文：一度取得したらオフラインでも読めるように cache-first
  if(url.host === "raw.githubusercontent.com"){
    e.respondWith(
      caches.match(req).then(c=> c || fetch(req).then(r=>{
        if(r && r.ok){ const cp=r.clone(); caches.open(CACHE).then(c=>c.put(req, cp)); }
        return r;
      }))
    );
    return;
  }

  // その他（辞書/Wikipedia/Gemini/CDN）：ネット優先、失敗時にキャッシュがあれば
  e.respondWith(fetch(req).catch(()=> caches.match(req)));
});
