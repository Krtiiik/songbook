// Reader preferences, kept in this browser only --------------------------------
// Storage can be unavailable (private mode, blocked site data): everything
// still works, it just isn't remembered.

const PREFIX = "songbook:";

function read(key, fallback = null) {
    try {
        const value = localStorage.getItem(PREFIX + key);
        return value === null ? fallback : JSON.parse(value);
    } catch {
        return fallback;
    }
}

function write(key, value) {
    try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
        // not remembered
    }
}

// Theme: "light" | "dark", defaulting to the system preference
export function getTheme() {
    return read("theme") ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

export function setTheme(theme) {
    write("theme", theme);
    applyTheme();
}

export function applyTheme() {
    document.documentElement.dataset.theme = getTheme();
}

// Song text size, 1 = 100 %
export const getZoom = () => read("zoom", 1);
export const setZoom = (zoom) => write("zoom", zoom);

// The version (source) last picked for a song
export const getVersion = (songId) => read(`version:${songId}`);
export const setVersion = (songId, versionId) => write(`version:${songId}`, versionId);
