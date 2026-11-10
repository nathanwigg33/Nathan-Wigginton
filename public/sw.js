const C='cv-v2';
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(['./','index.html','data.js','manifest.webmanifest','icon-192.png'])));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).pathname.startsWith('/api/'))return;
  e.respondWith(fetch(e.request).then(r=>{const cp=r.clone(); if(new URL(e.request.url).origin===location.origin) caches.open(C).then(c=>c.put(e.request,cp)); return r;}).catch(()=>caches.match(e.request,{ignoreSearch:true})));
});
