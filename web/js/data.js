// Song data written by bin/build.py ---------------------------------------------
//   index.json        { title, pdf, sources: {id: {label, url}}, songs: [{id, title, artist, versions}] }
//   songs/<id>.json   { id, versions: [{id, source, title, artist, key, capo, url, html}] }

export let index = { title: "", sources: {}, songs: [] };
const positions = new Map(); // song id -> position in index.songs
const cache = new Map(); // song id -> Promise of song data

export async function loadIndex() {
    index = await fetch("index.json").then((response) => response.json());
    index.songs.forEach((song, position) => positions.set(song.id, position));
    return index;
}

export function getEntry(id) {
    return positions.has(id) ? index.songs[positions.get(id)] : null;
}

/** The song `offset` places after (or before) the given one, wrapping around. */
export function getNeighbour(id, offset) {
    const count = index.songs.length;
    const position = positions.get(id) ?? 0;
    return index.songs[(((position + offset) % count) + count) % count];
}

/** 1-based place of the song in the list, the order seeking follows. */
export function getPosition(id) {
    return (positions.get(id) ?? 0) + 1;
}

export function getRandom() {
    return index.songs[Math.floor(Math.random() * index.songs.length)];
}

export function loadSong(id) {
    if (!cache.has(id)) {
        const request = fetch(`songs/${encodeURIComponent(id)}.json`).then((response) => {
            if (!response.ok) throw new Error(`Song ${id}: ${response.status}`);
            return response.json();
        });
        request.catch(() => cache.delete(id)); // allow a retry
        cache.set(id, request);
    }
    return cache.get(id);
}

/** Start loading the previous and next songs, so swiping feels instant. */
export function prefetchNeighbours(id) {
    for (const offset of [-1, 1]) {
        loadSong(getNeighbour(id, offset).id).catch(() => {});
    }
}

export function sourceLabel(sourceId) {
    return index.sources[sourceId]?.label ?? sourceId;
}
