// Service worker ---------------------------------------------------------------------
//
// Makes the site installable and readable offline. Every same-origin response is kept, so
// whatever the reader has opened (the app, the list, visited songs) works without a signal.
// Network first with a short timeout: a fresh deploy shows up at once, while a bad connection
// at a gig falls back to the saved copy instead of hanging.

const CACHE = "songbook";
const NETWORK_TIMEOUT = 4000;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

async function networkFirst(request) {
    const cache = await caches.open(CACHE);
    try {
        const response = await Promise.race([
            fetch(request),
            new Promise((_, reject) => setTimeout(reject, NETWORK_TIMEOUT)),
        ]);
        // 200 only: a partial (206) response cannot be stored. The PDF is large and not needed offline.
        if (response.status === 200 && !request.url.endsWith(".pdf")) cache.put(request, response.clone());
        return response;
    } catch {
        const saved = await cache.match(request, { ignoreSearch: true });
        if (saved) return saved;
        // A slow response may still arrive; only a failure with nothing saved is an error
        return request.mode === "navigate" ? (await cache.match("./")) ?? fetch(request) : fetch(request);
    }
}

self.addEventListener("fetch", (event) => {
    const { request } = event;
    if (request.method === "GET" && new URL(request.url).origin === location.origin) {
        event.respondWith(networkFirst(request));
    }
});
