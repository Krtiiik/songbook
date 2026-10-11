// Reader preferences, kept in this browser only --------------------------------
// Storage can be unavailable (private mode, blocked site data): everything
// still works, it just isn't remembered.

import { parseThemeChoice, resolveTheme } from "./theme.js";

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

// Theme choice: "light" | "dark" | "system" (the default, follows the device)
export function getTheme() {
    return parseThemeChoice(read("theme"));
}

export function setTheme(theme) {
    write("theme", theme);
    applyTheme();
}

// The browser chrome (status and navigation bar of an installed app) takes this colour; it is
// the page background of each theme, so keep it equal to --bg in theme.css.
const CHROME_COLOR = { light: "#fbfaf7", dark: "#15130f" };

const systemDark = matchMedia("(prefers-color-scheme: dark)");

export function applyTheme() {
    const theme = resolveTheme(getTheme(), systemDark.matches);
    document.documentElement.dataset.theme = theme;
    // The meta tags in index.html follow the system theme; the reader's own pick may differ
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
        meta.content = CHROME_COLOR[theme];
    }
}

// While the choice is "system", a change of the device setting shows at once
systemDark.addEventListener("change", applyTheme);

// Song text size, 1 = 100 %
export const getZoom = () => read("zoom", 1);
export const setZoom = (zoom) => write("zoom", zoom);

// Number of columns the reader flows songs into (limited to what fits the window when shown)
export const getColumns = () => read("columns", 1);
export const setColumns = (columns) => write("columns", columns);

// The version (source) last picked for a song
export const getVersion = (songId) => read(`version:${songId}`);
export const setVersion = (songId, versionId) => write(`version:${songId}`, versionId);
