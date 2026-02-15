const VERSION = "v1";
const APP_CACHE = `osterweg-app-${VERSION}`;
const AUDIO_CACHE = `osterweg-audio-${VERSION}`;

const APP_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./service-worker.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    await cache.addAll(APP_ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((key) => {
        if (key.startsWith("osterweg-") && key !== APP_CACHE && key !== AUDIO_CACHE) {
          return caches.delete(key);
        }
      })
    );
    self.clients.claim();
  })());
});

// Fetch-Strategie:
// - App-Dateien: network-first, fallback cache (damit Updates ankommen)
// - Audio: cache-first (damit es offline sicher läuft)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== "GET") return;

  // MP3 / Audio
  if (url.pathname.includes("/audio/") || url.pathname.endsWith(".mp3")) {
    event.respondWith((async () => {
      const cache = await caches.open(AUDIO_CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;

      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      } catch {
        return cached || Response.error();
      }
    })());
    return;
  }

  // App / Rest
  event.respondWith((async () => {
    const cache = await caches.open(APP_CACHE);
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) cache.put(req, fresh.clone());
      return fresh;
    } catch {
      const cached = await cache.match(req);
      return cached || (await cache.match("./index.html"));
    }
  })());
});

// Nachricht vom Button "Audios offline bereitstellen"
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "CACHE_ALL_AUDIO" && Array.isArray(data.urls)) {
    event.waitUntil((async () => {
      const cache = await caches.open(AUDIO_CACHE);
      await Promise.allSettled(
        data.urls.map(async (u) => {
          const req = new Request(u, { cache: "no-store" });
          const hit = await cache.match(req);
          if (hit) return;
          const res = await fetch(req);
          if (res && res.ok) await cache.put(req, res.clone());
        })
      );
    })());
  }
});
