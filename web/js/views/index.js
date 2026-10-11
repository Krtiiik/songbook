// Song list and search -----------------------------------------------------------
// Without a query the list has a section per first letter and an A-Z rail to seek
// through them (press and drag along it, a bubble names the letter until release);
// while searching it is a flat list of matches.

import Fuse from "../../vendor/fuse.mjs";
import { index } from "../data.js";
import { groupByLetter, railIndexAt } from "../letters.js";
import { goToSong, songHref } from "../router.js";

const list = document.getElementById("song-list");
const rail = document.getElementById("letter-rail");
const bubble = document.getElementById("letter-bubble");
const searchInput = document.getElementById("search-input");
const searchCount = document.getElementById("search-count");

const STICKY_OFFSET = 130; // a section counts as current once it reaches the bars stuck to the top

let fuse = null;
let shownSongs = [];
let headers = []; // section header elements, parallel to the rail's buttons
let seeking = null; // index of the letter the reader holds the rail on; null when not seeking

function songLink(song) {
    const link = document.createElement("a");
    link.href = songHref(song.id);
    link.className = "song-link";

    const text = document.createElement("span");
    text.className = "song-link-text";

    const title = document.createElement("span");
    title.className = "song-link-title";
    title.textContent = song.title;
    text.append(title);

    if (song.artist) {
        const artist = document.createElement("span");
        artist.className = "song-link-artist";
        artist.textContent = song.artist;
        text.append(artist);
    }
    link.append(text);

    if (song.versions.length > 1) {
        const versions = document.createElement("span");
        versions.className = "song-link-versions";
        versions.title = `${song.versions.length} verze`;
        versions.textContent = song.versions.length;
        link.append(versions);
    }
    return link;
}

function renderSections(songs) {
    headers = [];
    const nodes = [];
    for (const { letter, songs: group } of groupByLetter(songs)) {
        const header = document.createElement("h2");
        header.className = "letter-header";
        header.textContent = letter;
        headers.push(header);
        nodes.push(header, ...group.map(songLink));
    }
    list.replaceChildren(...nodes);

    rail.replaceChildren(...headers.map((header) => {
        const button = document.createElement("button");
        button.className = "rail-letter";
        button.textContent = header.textContent;
        // Pointer presses are handled by the rail's seek; this serves keyboard activation
        button.addEventListener("click", (event) => {
            if (event.detail === 0) header.scrollIntoView({ block: "start" });
        });
        return button;
    }));
    markCurrentLetter();
}

function renderMatches(songs) {
    headers = [];
    rail.replaceChildren();
    if (songs.length > 0) {
        list.replaceChildren(...songs.map(songLink));
    } else {
        list.replaceChildren(Object.assign(document.createElement("p"), {
            className: "no-results",
            textContent: "Nic nenalezeno",
        }));
    }
}

function renderList() {
    const query = searchInput.value.trim();
    shownSongs = query ? fuse.search(query).map((result) => result.item) : index.songs;
    searchCount.textContent = shownSongs.length;

    if (query) {
        renderMatches(shownSongs);
    } else {
        renderSections(shownSongs);
    }
    rail.classList.toggle("hidden", !headers.length);
}

/** Highlights the rail letter of the section being read. */
export function markCurrentLetter() {
    if (!headers.length || !headers[0].offsetParent) return; // not on screen: nothing to measure
    let current = 0;
    if (seeking !== null) {
        current = seeking; // the last sections cannot always reach the top, so trust the finger
    } else {
        headers.forEach((header, position) => {
            if (header.getBoundingClientRect().top <= STICKY_OFFSET) current = position;
        });
    }
    [...rail.children].forEach((button, position) => {
        button.setAttribute("aria-current", String(position === current));
    });
}

/** Jumps to the letter under the pointer and shows it in the bubble beside the finger. */
function seekTo(event) {
    const buttons = [...rail.children];
    if (!buttons.length) return;
    const top = buttons[0].getBoundingClientRect().top;
    const bottom = buttons.at(-1).getBoundingClientRect().bottom;
    const position = railIndexAt(event.clientY, top, bottom, buttons.length);

    bubble.style.setProperty("--bubble-y", `${Math.min(Math.max(event.clientY, top), bottom)}px`);
    if (position === seeking) return;
    seeking = position;
    bubble.textContent = headers[position].textContent;
    headers[position].scrollIntoView({ block: "start" });
    markCurrentLetter();
}

function stopSeeking() {
    if (seeking === null) return;
    seeking = null;
    bubble.classList.add("hidden");
    rail.classList.remove("seeking");
    markCurrentLetter();
}

function setupRailSeek() {
    rail.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || !headers.length) return;
        event.preventDefault();
        rail.setPointerCapture(event.pointerId);
        rail.classList.add("seeking");
        bubble.classList.remove("hidden");
        seekTo(event);
    });
    rail.addEventListener("pointermove", (event) => {
        if (seeking !== null) seekTo(event);
    });
    rail.addEventListener("pointerup", stopSeeking);
    rail.addEventListener("pointercancel", stopSeeking);
    rail.addEventListener("lostpointercapture", stopSeeking);
    rail.addEventListener("contextmenu", (event) => event.preventDefault()); // long press on a phone
}

/** Empties the search box so the whole list shows again. */
function resetSearch() {
    searchInput.value = "";
    renderList();
}

export function setupIndex() {
    fuse = new Fuse(index.songs, {
        keys: ["title", "artist"],
        threshold: 0.35,
        ignoreLocation: true,
        ignoreDiacritics: true,
    });
    renderList();
    setupRailSeek();

    searchInput.addEventListener("input", renderList);
    searchInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && shownSongs.length > 0) {
            goToSong(shownSongs[0].id);
        } else if (event.key === "Escape") {
            resetSearch();
        }
    });

    // The cross is a button inside the label, so keep focus in the box ready for the next query
    document.getElementById("search-clear").addEventListener("click", () => {
        resetSearch();
        searchInput.focus();
    });
    // Coming back from a song starts a fresh search; the browser's Back button keeps the old one
    document.getElementById("index-link").addEventListener("click", resetSearch);

    let scheduled = false;
    window.addEventListener("scroll", () => {
        if (scheduled || !headers.length) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            markCurrentLetter();
        });
    }, { passive: true });
}
