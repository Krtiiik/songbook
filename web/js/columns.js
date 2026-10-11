// Song columns -------------------------------------------------------------------
// The reader may flow a song into several columns on wide screens. How many fit is
// worked out from the window width, the same numbers as the column width in song.css
// (21em of the 20px wide-screen song text, 2em gap, scaled by the reader's text zoom).

export const MAX_COLUMNS = 3;

const COLUMN_WIDTH = 420;
const COLUMN_GAP = 40;
const PAGE_PADDING = 48; // each side

/** The most columns that fit a window of the given width (at least 1). */
export function maxColumns(viewportWidth, zoom = 1) {
    const available = viewportWidth - 2 * PAGE_PADDING + COLUMN_GAP * zoom;
    const fit = Math.floor(available / ((COLUMN_WIDTH + COLUMN_GAP) * zoom));
    return Math.max(1, Math.min(MAX_COLUMNS, fit));
}

/** A wanted column count limited to what fits. */
export function clampColumns(wanted, max) {
    return Math.max(1, Math.min(wanted, max));
}

/** The next count when cycling: 1, 2, ... max, then back to 1. */
export function nextColumns(current, max) {
    return current >= max ? 1 : current + 1;
}
