// Song list and search -----------------------------------------------------------
// Without a query the list has a section per first letter and an A-Z rail to jump
// between them; while searching it is a flat list of matches.

import Fuse from "../../vendor/fuse.mjs";
import { index } from "../data.js";
import { groupByLetter } from "../letters.js";
import { goToSong, songHref } from "../router.js";

const list = document.getElementById("song-list");
const rail = document.getElementById("letter-rail");
const searchInput = document.getElementById("search-input");
const searchCount = document.getElementById("search-count");

const STICKY_OFFSET = 130; // a section counts as current once it reaches the bars stuck to the top

let fuse = null;
let shownSongs = [];
let headers = []; // section header elements, parallel to the rail's buttons

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
        button.addEventListener("click", () => header.scrollIntoView({ block: "start" }));
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
    headers.forEach((header, position) => {
        if (header.getBoundingClientRect().top <= STICKY_OFFSET) current = position;
    });
    [...rail.children].forEach((button, position) => {
        button.setAttribute("aria-current", String(position === current));
    });
}

export function setupIndex() {
    fuse = new Fuse(index.songs, {
        keys: ["title", "artist"],
        threshold: 0.35,
        ignoreLocation: true,
        ignoreDiacritics: true,
    });
    renderList();

    searchInput.addEventListener("input", renderList);
    searchInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && shownSongs.length > 0) {
            goToSong(shownSongs[0].id);
        } else if (event.key === "Escape") {
            searchInput.value = "";
            renderList();
        }
    });

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
