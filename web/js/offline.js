// Installable app --------------------------------------------------------------------
//
// Registers the service worker (sw.js), which browsers require before offering to install
// the site on a phone and which keeps opened songs available offline.

export function setupOffline() {
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("sw.js").catch((error) => console.warn("Service worker failed:", error));
    }
}
