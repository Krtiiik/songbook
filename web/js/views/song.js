// Song view ------------------------------------------------------------------------

import { renderChordDiagrams } from "../chords.js";
import { clampColumns, maxColumns, nextColumns } from "../columns.js";
import {
    getEntry, getNeighbour, getPosition, getRandom, index, loadSong, prefetchNeighbours, sourceLabel,
} from "../data.js";
import { replayEnter } from "../motion.js";
import { closeAll, popover } from "../popover.js";
import { goToSong } from "../router.js";
import * as settings from "../settings.js";
import { transposeChord } from "../transpose.js";
import { sourceInitial, stackOrder } from "../versions.js";

const page = document.getElementById("song-page");
const content = document.getElementById("song-content");
const header = document.getElementById("song-header");
const title = document.getElementById("song-title");
const artist = document.getElementById("song-artist");
const capo = document.getElementById("song-capo");
const versions = document.getElementById("song-versions");
const versionButton = document.getElementById("version-toggle");
const versionStack = document.getElementById("version-stack");
const source = document.getElementById("song-source");
const position = document.getElementById("song-position");

const MAX_DEPTH = 3; // circles deeper than the third are hidden; keep in step with base.css

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
    position.textContent = `${getPosition(songId)} / ${index.songs.length}`;
    renderSources(song, version);
    document.title = version.title;

    content.innerHTML = version.html; // rendered and escaped by chordpro-renderer at build time
    content.scrollTop = 0;
    window.scrollTo(0, 0);
    closeAll();
    setTranspose(0);
    replayEnter(header, content);

    prefetchNeighbours(songId);
}

/** Version button, its pills and a link to the original songbook. */
function renderSources(song, version) {
    renderVersionButton(song, version);

    versions.replaceChildren(...song.versions.map((v) => {
        const button = document.createElement("button");
        button.className = "version-button";
        button.textContent = sourceLabel(v.source);
        button.title = [v.key && `Tónina ${v.key}`, v.capo && `Capo ${v.capo}`].filter(Boolean).join(", ");
        button.setAttribute("aria-pressed", String(v.id === version.id));
        button.addEventListener("click", () => {
            closeAll();
            if (v.id === current.versionId) return;
            settings.setVersion(current.id, v.id);
            goToSong(current.id, v.id, { replace: true });
        });
        return button;
    }));

    const several = song.versions.length > 1;
    const items = [];
    if (!several && version.url) {
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
        link.textContent = "zdroj";
        items.push(link);
    }
    source.replaceChildren(...items);
}

/**
 * A stack of circles, one per version, the shown one in front. The circles are kept while
 * the reader stays on the same song, so that switching versions moves them (CSS transition
 * on `data-depth`) instead of redrawing them.
 */
function renderVersionButton(song, version) {
    const ids = song.versions.map((v) => v.id);
    const stackKey = [song.id, ...ids].join("|");

    if (versionStack.dataset.key !== stackKey) {
        versionStack.dataset.key = stackKey;
        versionStack.replaceChildren(...song.versions.map((v) => Object.assign(document.createElement("span"), {
            className: "version-chip",
            textContent: sourceInitial(sourceLabel(v.source)),
        })));
    }

    const order = stackOrder(ids, version.id);
    [...versionStack.children].forEach((chip, i) => {
        chip.dataset.depth = Math.min(order.indexOf(ids[i]), MAX_DEPTH);
    });

    const label = `Verze: ${sourceLabel(version.source)}`;
    versionButton.title = label;
    versionButton.setAttribute("aria-label", label);
    versionButton.classList.remove("hidden");
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
    page.style.setProperty("--zoom", zoom);
    document.getElementById("zoom-show").textContent = `${Math.round(zoom * 100)}%`;
    applyColumns(); // a larger text leaves room for fewer columns
}

// Columns --------------------------------------------------------------------------

const columnsButton = document.getElementById("columns-toggle");

/** The chosen number of columns, limited to what fits the window now. */
function fittingColumns() {
    const max = maxColumns(window.innerWidth, settings.getZoom());
    return { max, columns: clampColumns(settings.getColumns(), max) };
}

function applyColumns() {
    const { max, columns } = fittingColumns();
    page.style.setProperty("--columns", columns);
    columnsButton.classList.toggle("hidden", max < 2);
    document.getElementById("columns-badge").textContent = columns;
    columnsButton.title = `Sloupce: ${columns}`;
    columnsButton.setAttribute("aria-label", `Sloupce: ${columns}`);
}

function cycleColumns() {
    const { max, columns } = fittingColumns();
    settings.setColumns(nextColumns(columns, max));
    applyColumns();
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

    popover(versionButton, byId("version-box"));

    popover(byId("transpose-toggle"), byId("transpose-box"));
    byId("transpose-up").addEventListener("click", () => setTranspose(transpose + 1));
    byId("transpose-down").addEventListener("click", () => setTranspose(transpose - 1));
    byId("transpose-reset").addEventListener("click", () => setTranspose(0));

    popover(byId("zoom-toggle"), byId("zoom-box"));
    byId("zoom-in").addEventListener("click", () => setZoom(settings.getZoom() + 0.25));
    byId("zoom-out").addEventListener("click", () => setZoom(settings.getZoom() - 0.25));
    byId("zoom-reset").addEventListener("click", () => setZoom(1));
    setZoom(settings.getZoom());

    columnsButton.addEventListener("click", cycleColumns);
    window.addEventListener("resize", applyColumns);

    const chordsBox = byId("chords-box");
    popover(byId("chords-toggle"), chordsBox, { onOpen: () => renderChordDiagrams(chordsBox, displayedChords()) });

    byId("random-song").addEventListener("click", () => goToSong(getRandom().id, null, { replace: true }));
    byId("seek-previous").addEventListener("click", () => seek(-1));
    byId("seek-next").addEventListener("click", () => seek(1));
    setupSwipes();
    setupKeys(isActive);
}
