import { readdirSync, writeFileSync } from "node:fs";
const assets = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.png",
  "./icon-512.png",
  ...readdirSync("dist/assets").map((f) => "./assets/" + f),
];
const version = "papertrack-" + Date.now();
writeFileSync(
  "dist/sw.js",
  `const CACHE=${JSON.stringify(version)},ASSETS=${JSON.stringify(assets)};self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('papertrack-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(caches.match(e.request,{ignoreVary:true}).then(hit=>hit||fetch(e.request).catch(()=>e.request.mode==='navigate'?caches.match('./index.html'):Response.error())));});`,
);
