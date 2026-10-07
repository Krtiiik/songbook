// Songbook app entry point ---------------------------------------------------------
//
//   data.js       loads index.json and songs/<id>.json
//   router.js     URL hash <-> what is shown
//   views/        song list (index.js) and song (song.js)
//   transpose.js  chord transposition, chords.js chord diagrams, tuner.js tuner
//   settings.js   preferences remembered in the browser (theme, zoom, versions)

import { index, getEntry, loadIndex } from "./data.js";
import { currentRoute, onRouteChange } from "./router.js";
import * as settings from "./settings.js";
import { setupTuner } from "./tuner.js";
import { setupIndex } from "./views/index.js";
import { setupSong, showSong } from "./views/song.js";

settings.applyTheme();

let view = null;

function showView(name) {
    view = name;
    document.body.dataset.view = name;
}

function route({ songId, versionId }) {
    if (songId && getEntry(songId)) {
        showView("song");
        showSong(songId, versionId);
    } else {
        showView("index");
        document.title = index.title;
    }
}

async function start() {
    await loadIndex();
    document.getElementById("index-title").textContent = index.title;
    document.getElementById("pdf-link").classList.toggle("hidden", !index.pdf);

    setupIndex();
    setupSong({ isActive: () => view === "song" });
    setupTuner();
    for (const button of document.querySelectorAll(".theme-toggle")) {
        button.addEventListener("click", () => settings.setTheme(settings.getTheme() === "dark" ? "light" : "dark"));
    }

    onRouteChange(route);
    route(currentRoute());
}

start();
