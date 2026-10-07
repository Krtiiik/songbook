// Song list and search -----------------------------------------------------------

import Fuse from "../../vendor/fuse.mjs";
import { index } from "../data.js";
import { goToSong, songHref } from "../router.js";

const list = document.getElementById("song-list");
const searchBox = document.getElementById("search-box");
const searchInput = document.getElementById("search-input");

let fuse = null;
let shownSongs = [];

function songLink(song) {
    const link = document.createElement("a");
    link.href = songHref(song.id);
    link.className = "song-link";

    const title = document.createElement("span");
    title.className = "song-link-title";
    title.textContent = song.title;
    link.append(title);

    if (song.artist) {
        const artist = document.createElement("span");
        artist.className = "song-link-artist";
        artist.textContent = song.artist;
        link.append(artist);
    }

    if (song.versions.length > 1) {
        const versions = document.createElement("span");
        versions.className = "song-link-versions";
        versions.title = `${song.versions.length} verze`;
        versions.textContent = song.versions.length;
        link.append(versions);
    }
    return link;
}

function renderList(songs) {
    shownSongs = songs;
    list.replaceChildren(...songs.map(songLink));
}

function search(query) {
    const text = query.trim();
    if (!text) return index.songs;
    return fuse.search(text).map((result) => result.item);
}

function setSearchOpen(open) {
    searchBox.classList.toggle("hidden", !open);
    if (open) {
        searchInput.focus();
        searchInput.select();
    } else {
        searchInput.value = "";
        renderList(index.songs);
    }
}

export function setupIndex() {
    fuse = new Fuse(index.songs, {
        keys: ["title", "artist"],
        threshold: 0.35,
        ignoreLocation: true,
        ignoreDiacritics: true,
    });
    renderList(index.songs);

    document.getElementById("search-toggle").addEventListener("click", () => {
        setSearchOpen(searchBox.classList.contains("hidden"));
    });
    searchInput.addEventListener("input", () => renderList(search(searchInput.value)));
    searchInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && shownSongs.length > 0) {
            goToSong(shownSongs[0].id);
        } else if (event.key === "Escape") {
            setSearchOpen(false);
        }
    });
}
