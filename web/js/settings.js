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

// The browser chrome (status and navigation bar of an installed app) takes this colour; it is
// the page background of each theme, so keep it equal to --bg in theme.css.
const CHROME_COLOR = { light: "#fbfaf7", dark: "#15130f" };

export function applyTheme() {
    const theme = getTheme();
    document.documentElement.dataset.theme = theme;
    // The meta tags in index.html follow the system theme; the reader's own pick may differ
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
        meta.content = CHROME_COLOR[theme];
    }
}

// Song text size, 1 = 100 %
export const getZoom = () => read("zoom", 1);
export const setZoom = (zoom) => write("zoom", zoom);

// Number of columns the reader flows songs into (limited to what fits the window when shown)
export const getColumns = () => read("columns", 1);
export const setColumns = (columns) => write("columns", columns);

// The version (source) last picked for a song
export const getVersion = (songId) => read(`version:${songId}`);
export const setVersion = (songId, versionId) => write(`version:${songId}`, versionId);
