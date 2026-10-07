// Song view ------------------------------------------------------------------------

import { renderChordDiagrams } from "../chords.js";
import { getEntry, getNeighbour, getRandom, loadSong, prefetchNeighbours, sourceLabel } from "../data.js";
import { closeAll, popover } from "../popover.js";
import { goToSong } from "../router.js";
import * as settings from "../settings.js";
import { transposeChord } from "../transpose.js";

const content = document.getElementById("song-content");
const title = document.getElementById("song-title");
const artist = document.getElementById("song-artist");
const capo = document.getElementById("song-capo");
const sources = document.getElementById("song-sources");

let current = null; // { id, versionId }
let renderToken = 0;

// Rendering ------------------------------------------------------------------------

export async function showSong(songId, versionId) {
    const token = ++renderToken;
    const entry = getEntry(songId);

    let song;
    try {
        song = await loadSong(songId);
    } catch (error) {
        console.error(error);
        if (token === renderToken) content.textContent = "Píseň se nepodařilo načíst.";
        return;
    }
    if (token !== renderToken) return; // a newer navigation won

    const preferred = versionId ?? settings.getVersion(songId);
    const version = song.versions.find((v) => v.id === preferred) ?? song.versions[0];
    current = { id: songId, versionId: version.id };

    title.textContent = version.title;
    artist.textContent = version.artist ?? entry.artist ?? "";
    capo.textContent = version.capo ? `Capo ${version.capo}` : "";
    renderSources(song, version);
    document.title = version.title;

    content.innerHTML = version.html; // rendered and escaped by chordpro-renderer at build time
    content.scrollTop = 0;
    window.scrollTo(0, 0);
    closeAll();
    setTranspose(0);

    prefetchNeighbours(songId);
}

/** Version switcher (when there are several) and a link to the original songbook. */
function renderSources(song, version) {
    const items = [];

    if (song.versions.length > 1) {
        for (const v of song.versions) {
            const button = document.createElement("button");
            button.className = "version-button";
            button.textContent = sourceLabel(v.source);
            button.title = [v.key && `Tónina ${v.key}`, v.capo && `Capo ${v.capo}`].filter(Boolean).join(", ");
            button.setAttribute("aria-pressed", String(v.id === version.id));
            button.addEventListener("click", () => {
                settings.setVersion(current.id, v.id);
                goToSong(current.id, v.id, { replace: true });
            });
            items.push(button);
        }
    } else if (version.url) {
        items.push(Object.assign(document.createElement("span"), {
            className: "version-label",
            textContent: sourceLabel(version.source),
        }));
    }

    if (version.url) {
        const link = document.createElement("a");
        link.className = "source-link";
        link.href = version.url;
        link.target = "_blank";
        link.rel = "noopener";
        link.title = `Originál: ${sourceLabel(version.source)}`;
        link.innerHTML = '<i class="bi bi-box-arrow-up-right"></i>';
        items.push(link);
    }

    sources.replaceChildren(...items);
}

// Transposition --------------------------------------------------------------------

let transpose = 0;

function setTranspose(semitones) {
    transpose = ((semitones % 12) + 12) % 12;
    if (transpose > 6) transpose -= 12; // show -1 rather than +11

    content.querySelectorAll(".cp-chord").forEach((chord) => {
        chord.textContent = transposeChord(chord.dataset.chord, transpose);
    });
    document.getElementById("transpose-show").textContent = transpose > 0 ? `+${transpose}` : String(transpose);
}

function displayedChords() {
    return [...new Set([...content.querySelectorAll(".cp-chord")].map((chord) => chord.textContent.trim()))]
        .filter(Boolean);
}

// Zoom -----------------------------------------------------------------------------

function setZoom(zoom) {
    zoom = Math.min(2, Math.max(0.5, zoom));
    settings.setZoom(zoom);
    content.style.fontSize = `${zoom}em`;
    document.getElementById("zoom-show").textContent = `${Math.round(zoom * 100)}%`;
}

// Moving between songs ---------------------------------------------------------------

function seek(offset) {
    if (current) goToSong(getNeighbour(current.id, offset).id, null, { replace: true });
}

function setupSwipes() {
    let start = null;
    content.addEventListener("touchstart", (event) => {
        const touch = event.changedTouches[0];
        start = { x: touch.screenX, y: touch.screenY, time: event.timeStamp };
    }, { passive: true });

    content.addEventListener("touchend", (event) => {
        if (!start) return;
        const touch = event.changedTouches[0];
        const dx = touch.screenX - start.x;
        const dy = touch.screenY - start.y;
        const duration = event.timeStamp - start.time;
        start = null;

        // A quick, mostly horizontal swipe of at least 100 px
        if (Math.abs(dy) > Math.abs(dx) || Math.abs(dx) < 100 || duration > 400) return;
        seek(dx < 0 ? 1 : -1);
    });
}

function setupKeys(isActive) {
    document.addEventListener("keydown", (event) => {
        if (!isActive() || event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.target.closest("input, select, textarea")) return;
        if (event.key === "ArrowLeft") seek(-1);
        if (event.key === "ArrowRight") seek(1);
    });
}

// Setup ------------------------------------------------------------------------------

export function setupSong({ isActive }) {
    const byId = (id) => document.getElementById(id);

    popover(byId("transpose-toggle"), byId("transpose-box"));
    byId("transpose-up").addEventListener("click", () => setTranspose(transpose + 1));
    byId("transpose-down").addEventListener("click", () => setTranspose(transpose - 1));
    byId("transpose-reset").addEventListener("click", () => setTranspose(0));

    popover(byId("zoom-toggle"), byId("zoom-box"));
    byId("zoom-in").addEventListener("click", () => setZoom(settings.getZoom() + 0.25));
    byId("zoom-out").addEventListener("click", () => setZoom(settings.getZoom() - 0.25));
    byId("zoom-reset").addEventListener("click", () => setZoom(1));
    setZoom(settings.getZoom());

    const chordsBox = byId("chords-box");
    popover(byId("chords-toggle"), chordsBox, { onOpen: () => renderChordDiagrams(chordsBox, displayedChords()) });

    byId("random-song").addEventListener("click", () => goToSong(getRandom().id, null, { replace: true }));
    byId("seek-previous").addEventListener("click", () => seek(-1));
    byId("seek-next").addEventListener("click", () => seek(1));
    setupSwipes();
    setupKeys(isActive);
}
