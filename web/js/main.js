// Songbook app entry point ---------------------------------------------------------
//
//   data.js       loads index.json and songs/<id>.json
//   router.js     URL hash <-> what is shown
//   views/        song list (index.js) and song (song.js)
//   letters.js    letter sections of the list, columns.js how many song columns fit
//   transpose.js  chord transposition, chords.js chord diagrams, tuner.js tuner
//   versions.js   letters and stacking order of the version button
//   motion.js     the fade-and-rise when a view or song appears, and a song following a swipe
//   swipe.js      when a sideways drag counts as a swipe between songs
//   settings.js   preferences remembered in the browser (theme, zoom, versions)
//   settings-menu.js  the settings modal opened from the top bars (theme choice, tuner)
//   theme.js      what the theme choice (light, dark, system) resolves to
//   offline.js    registers the service worker that makes the site installable

import { index, getEntry, loadIndex } from "./data.js";
import { setupOffline } from "./offline.js";
import { currentRoute, onRouteChange } from "./router.js";
import { replayEnter } from "./motion.js";
import * as settings from "./settings.js";
import { setupSettingsMenu } from "./settings-menu.js";
import { setupTuner } from "./tuner.js";
import { markCurrentLetter, setupIndex } from "./views/index.js";
import { setupSong, showSong } from "./views/song.js";

settings.applyTheme();

let view = null;

function showView(name) {
    if (name === "index" && view !== "index") replayEnter(document.getElementById("index"));
    view = name;
    document.body.dataset.view = name;
}

function route({ songId, versionId }) {
    if (songId && getEntry(songId)) {
        showView("song");
        showSong(songId, versionId);
    } else {
        showView("index");
        markCurrentLetter();
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
    setupSettingsMenu();
    setupOffline();

    onRouteChange(route);
    route(currentRoute());
}

start();
