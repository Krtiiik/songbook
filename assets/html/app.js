// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Songbook app
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Data ------------------------------------------------------------------------
const View = {
    Index: "Index",
    Song: "Song",
};

let currentView = View.Index;

let songs = {};
let songsIds = [];
let songIdsIndices = {};
let songsCount = 0;
let currentSongIndex = 0;
let songSearchMap = {};
let searchFuse = null;

// Load data on DOM ready
window.addEventListener("DOMContentLoaded", async () => {
    // Load the songs' data
    songs = await fetch("songs.json").then(r => r.json());
    songsIds = Object.keys(songs)
    songsCount = songsIds.length;
    songIdsIndices = Object.fromEntries(songsIds.map((value, index) => [value, index]));

    setupSeeks();
    setupTranspositions();
    setupSwipes();
    setupZoom();
    setupChords();
    setupTuner();
    setupDarkmode();
    setupSearch();
    setupRandomSong();

    router();
});

window.addEventListener("hashchange", router);

// View ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

function router() {
    const id = location.hash.slice(1); // remove '#'

    if (!id || !(id in songs)) {
        switchView(View.Index);
        document.title = "Krtkův Zpěvník";
    }
    else {
        loadSong(id);
        switchView(View.Song);
    }
}

function switchView(view) {
    switch (view) {
        case View.Index:
            document.getElementById("index-header").classList.toggle("hidden", false);
            document.getElementById("index-songs").classList.toggle("hidden", false);
            document.getElementById("song-header").classList.toggle("hidden", true);
            document.getElementById("song-content").classList.toggle("hidden", true);
            break;
        case View.Song:
            document.getElementById("index-header").classList.toggle("hidden", true);
            document.getElementById("index-songs").classList.toggle("hidden", true);
            document.getElementById("search-results").classList.toggle("hidden", true);
            document.getElementById("song-header").classList.toggle("hidden", false);
            document.getElementById("song-content").classList.toggle("hidden", false);
            break;
        default:
            console.error("Unrecognized view", view);
    }
}

// Song view ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Load a song into the song element
function loadSong(id) {
    if (!(id in songs)) return;
    const song = songs[id];

    location.hash = id; // updates URL without reload

    document.getElementById("song-title").textContent = song.title;
    document.getElementById("song-artist").textContent = song.artist;
    if (song.capo) {
        document.getElementById("song-meta-capo").textContent = "Capo " + song.capo;
    }
    else {
        document.getElementById("song-meta-capo").textContent = "";
    }
    if (song.source) {
        if (song.url) {
            document.getElementById("song-meta-source").innerHTML =
                `<a href="${song.url}"><i class="bi bi-box-arrow-up-left"></i><span>${song.source}</span></a>`;
        } else {
            document.getElementById("song-meta-source").innerHTML = song.source;
        }
    } else {
        document.getElementById("song-meta-source").innerHTML = "";
    }
    document.getElementById("song-content").innerHTML = song.content;
    document.title = song.title;

    currentSongIndex = songIdsIndices[id];
}

function loadCurrentSong() {
    loadSong(songsIds[currentSongIndex]);
    transposeReset();
    resetChordDiagrams();
}

function nextSong() {
    currentSongIndex = (currentSongIndex + 1) % songsCount;
    loadCurrentSong();
}

function prevSong() {
    currentSongIndex = (((currentSongIndex - 1) % songsCount) + songsCount) % songsCount;
    loadCurrentSong();
}

function setupSeeks() {
    const seekPreviousBtn = document.getElementById("seek-previous");
    const seekNextBtn = document.getElementById("seek-next");

    if (seekPreviousBtn) seekPreviousBtn.addEventListener("click", prevSong);
    if (seekNextBtn) seekNextBtn.addEventListener("click", nextSong);

    // On desktop, allow left/right arrow keys to seek previous/next.
    // If the device supports touch, avoid adding keyboard seeks to prevent
    // interfering with mobile behavior.
    if (!('ontouchstart' in window)) {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                prevSong();
            } else if (e.key === 'ArrowRight') {
                nextSong();
            }
        });
    }
}

// Swipe gestures --------------------------------------------------------------

let touchStartX = 0;
let touchEndX = 0;
let touchStartY = 0;
let touchEndY = 0;
let touchStartTime = 0;
let touchEndTime = 0;

function handleSwipe() {
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;
    const timeDiff = touchEndTime - touchStartTime;

    // Maximum Y swipe distance
    if (Math.abs(diffY) > 40) return;

    // Minimum X swipe distance
    if (Math.abs(diffX) < 150) return;

    // Maximum swipe duration: 0.2 seconds
    if (timeDiff > 200) return;

    if (diffX < 0) {
        // Swipe LEFT → next song
        nextSong();
    } else {
        // Swipe RIGHT → previous song
        prevSong();
    }
}

function setupSwipes() {
    const songArea = document.getElementById("song-content");

    songArea.addEventListener("touchstart", (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
        touchStartTime = e.timeStamp;
    });

    songArea.addEventListener("touchend", (e) => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        touchEndTime = e.timeStamp;

        handleSwipe();
    });
}

// Transpositions ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// ------------------------------
//  TRANSPOSE ENGINE (ChordMagic)
//  https://github.com/nolanlawson/chord-magic
// ------------------------------
!function (n, r) { "object" == typeof exports && "undefined" != typeof module ? r(exports) : "function" == typeof define && define.amd ? define(["exports"], r) : r(n.chordMagic = {}) }(this, function (n) { "use strict"; var d = { English: { A: ["A"], Bb: ["Bb", "A#", "Asharp", "Bflat"], B: ["B"], C: ["C"], Db: ["Db", "C#", "Dflat", "Csharp"], D: ["D"], Eb: ["Eb", "D#", "Eflat", "Dsharp"], E: ["E"], F: ["F"], Gb: ["Gb", "F#", "Gflat", "Fsharp"], G: ["G"], Ab: ["Ab", "G#", "Aflat", "Gsharp"] }, NorthernEuropean: { A: ["A"], Bb: ["B", "A#", "Asharp"], B: ["H"], C: ["C"], Db: ["Db", "C#", "Dflat", "Csharp"], D: ["D"], Eb: ["Eb", "D#", "Eflat", "Dsharp"], E: ["E"], F: ["F"], Gb: ["Gb", "F#", "Gflat", "Fsharp"], G: ["G"], Ab: ["Ab", "G#", "Aflat", "Gsharp"] }, SouthernEuropean: { A: ["La"], Bb: ["Tib", "La#"], B: ["Ti"], C: ["Do"], Db: ["Reb", "Réb", "Do#"], D: ["Re", "Ré"], Eb: ["Mib", "Re#"], E: ["Mi"], F: ["Fa"], Gb: ["Solb", "Sob", "Fa#"], G: ["Sol", "So"], Ab: ["Lab", "So#", "Sol#"] } }, u = { Add9: ["add9", "2"], Add11: ["add11", "4"], Major6: ["6", "maj6", "major6", "M6"], SixNine: ["6/9"], PowerChord: ["5"] }, s = { Sus4: ["sus4", "suspended", "sus"], Sus2: ["sus2", "suspended2"] }, f = { Major: ["", "major", "maj", "M"], Minor: ["m", "minor", "min"], Augmented: ["aug", "augmented", "+"], Diminished: ["dim", "diminished"] }, c = { Major7: ["Major", ["maj7", "Maj7", "M7", "+7"]], Minor7: ["Minor", ["m7", "Min7", "min7", "minor7", "-7"]], Dominant7: ["Major", ["7", "dom7", "dominant7"]], Diminished7: ["Diminished", ["dim7", "diminished7"]], Major9: ["Major", ["maj9", "M9", "9"]], Major11: ["Major", ["maj11", "M11", "11"]], Major13: ["Major", ["maj13", "M13", "13"]], AugmentedDominant7: ["Major", ["7#5", "7(#5]"]], AugmentedMajor7: ["Major", ["maj7#5", "maj7(#5]"]], Minor9: ["Minor", ["min9", "m9", "minor9"]] }; function b(n) { return "(" + n + "?)" } function h(r) { var e = []; return Object.keys(r).forEach(function (n) { e = e.concat(r[n]) }), e } function m(n, r) { (n = n.slice()).sort(function (n, r) { var e = r.length - n.length; return 0 !== e ? e < 0 ? -1 : 1 : n < r ? -1 : 1 }); var e = "("; return r || (e += "?:"), n.forEach(function (n, r) { n && (0 < r && (e += "|"), e += n.replace(/([[\]^$|()\\+*?{}=!])/gi, "\\$1")) }), e + ")" } var p, t = (p = {}, Object.keys(d).forEach(function (n) { var r, e, o, t, a, i; p[n] = (r = {}, e = m(h(t = d[n]), !0) + b(m(h(f).concat((a = c, i = [], Object.keys(a).forEach(function (n) { i = i.concat(a[n][1]) }), i)))) + b(m(h(u))) + b(m(h(s))) + b("(?:/" + m(h(t)) + ")"), o = "[\\(\\[]" + e + "[\\)\\]]", r.regexString = e, r.regexStringWithParens = o, r.pattern = new RegExp(e), r.patternWithParens = new RegExp(o), r) }), p), a = {}; Object.keys(d).forEach(function (n) { a[n] = {}, r(a[n], d[n]) }); var i = {}; r(i, f); var j, g, E = {}; j = E, g = c, Object.keys(g).forEach(function (r) { var n = g[r], e = n[0], o = n[1]; o.forEach(function (n) { j[n] = { quality: e, extended: r } }) }); var l = {}; r(l, s); var M = {}; function r(e, n) { Object.keys(n).forEach(function (r) { n[r].forEach(function (n) { e[n] = r }) }) } r(M, u); var o = ["A", "Bb", "B", "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab"]; function v(n, r) { var e = o.indexOf(n); if (-1 === e) throw new Error("unknown note: " + n); return 0 < (e += r) ? e %= o.length : e = (o.length + e) % o.length, o[e] } n.parse = function (n, r) { var e = (r = r || {}).naming || "English", o = n.match(t[e].pattern); return o && function (n, r) { var e = {}; e.root = a[r][n[1]]; var o = E[n[2]]; return o ? (e.quality = o.quality, e.extended = o.extended) : e.quality = i[n[2]], n[3] && (e.added = M[n[3]]), n[4] && (e.suspended = l[n[4]]), n[5] && (e.overridingRoot = a[r][n[5].substring(1)]), e }(o, e) }, n.prettyPrint = function (n, r) { var e, o = (r = r || {}).naming || "English"; if ("string" == typeof o) e = function (n) { return d[o][n][0] }; else { var t = Object.keys(d.English); e = function (n) { return o[t.indexOf(n)] } } var a = e(n.root); return n.extended ? a += c[n.extended][1][0] : a += f[n.quality][0], n.added && (a += u[n.added][0]), n.suspended && (a += s[n.suspended][0]), n.overridingRoot && (a += "/" + e(n.overridingRoot)), a }, n.transpose = function (n, r) { if ("number" != typeof r) throw new Error("you need to provide a number"); var e = JSON.parse(JSON.stringify(n)); return e.root = v(n.root, r), n.overridingRoot && (e.overridingRoot = v(n.overridingRoot, r)), e }, Object.defineProperty(n, "__esModule", { value: !0 }) });
var sharpsOnly = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#']

let currentTranspose = 0;

function transposeChord(chord, semitones) {
    try {
        var chord = chordMagic.parse(chord);
        var chord = chordMagic.transpose(chord, semitones);
        return chordMagic.prettyPrint(chord, { naming: sharpsOnly });
    } catch (e) {
        console.warn("ChordMagic could not transpose:", chord, e);
        return chord; // fallback
    }
}

function updateTransposeDisplay() {
    const el = document.getElementById("transpose-show");
    if (!el) return;

    if (currentTranspose === 0) {
        el.textContent = "0";
    } else if (currentTranspose > 0) {
        el.textContent = "+" + currentTranspose;
    } else {
        el.textContent = currentTranspose; // already negative, e.g. -3
    }
}

function applyTranspose() {
    document.querySelectorAll('.cp-chord').forEach(el => {
        const original = el.dataset.chord;
        const transposed = transposeChord(original, currentTranspose);
        el.textContent = transposed;
    });
    updateTransposeDisplay();
}

function transposeUp() {
    currentTranspose = (currentTranspose + 1) % 12;
    applyTranspose();
}

function transposeDown() {
    currentTranspose = (currentTranspose - 1) % 12;
    applyTranspose();
}

function transposeReset() {
    currentTranspose = 0;
    applyTranspose();
}

function getCurrentTranspose() {
    return currentTranspose;
}

function setupTranspositions() {
    const upBtn = document.getElementById("transpose-up");
    const downBtn = document.getElementById("transpose-down");
    const resetBtn = document.getElementById("transpose-reset");
    const toggleBtn = document.getElementById("transpose-toggle");
    const box = document.getElementById("transpose-box");
    const transposeShow = document.getElementById("transpose-show");

    if (upBtn) upBtn.addEventListener("click", transposeUp);
    if (downBtn) downBtn.addEventListener("click", transposeDown);
    if (resetBtn) resetBtn.addEventListener("click", transposeReset);

    toggleBtn.addEventListener("click", () => {
        box.classList.toggle("hidden");
    });

    document.addEventListener("click", (event) => {
        if (
            !box.contains(event.target) &&
            !toggleBtn.contains(event.target)
        ) {
            box.classList.add("hidden");
        }
    });
}

// Mobile Zoom ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

let zoomLevel = 1;
let zoomIncrement = 0.25;

function applyZoom() {
    const content = document.getElementById("song-content");
    content.style.fontSize = `${zoomLevel}em`;
    updateZoomDisplay();
}

function resetZoom() {
    zoomLevel = 1;
    applyZoom();
}

function zoomIn() {
    zoomLevel = Math.min(zoomLevel + zoomIncrement, 2.0); // max 200%
    applyZoom();
}

function zoomOut() {
    zoomLevel = Math.max(zoomLevel - zoomIncrement, 0.5); // min 50%
    applyZoom();
}

function getCurrentZoom() {
    return zoomLevel;
}

function updateZoomDisplay() {
    const el = document.getElementById("zoom-show");
    if (!el) return;

    el.textContent = Math.round(zoomLevel * 100) + "%";
}

function setupZoom() {
    const zoomInBtn = document.getElementById("zoom-in");
    const zoomOutBtn = document.getElementById("zoom-out");
    const zoomResetBtn = document.getElementById("zoom-reset");
    const zoomToggleBtn = document.getElementById("zoom-toggle");
    const zoomBox = document.getElementById("zoom-box");
    const zoomShow = document.getElementById("zoom-show");

    if (zoomInBtn) zoomInBtn.addEventListener("click", zoomIn);
    if (zoomOutBtn) zoomOutBtn.addEventListener("click", zoomOut);
    if (zoomResetBtn) zoomResetBtn.addEventListener("click", resetZoom);

    zoomToggleBtn.addEventListener("click", () => {
        zoomBox.classList.toggle("hidden");
    });

    document.addEventListener("click", (event) => {
        if (
            !zoomBox.contains(event.target) &&
            !zoomToggleBtn.contains(event.target)
        ) {
            zoomBox.classList.add("hidden");
        }
    });
}

// Chord diagrams ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

let CHORD_DB = null;
let renderedTransposition = null;
const rootsOrdered = ['A#', 'C#', 'D#', 'F#', 'G#', 'A', 'B', 'C', 'D', 'E', 'F', 'G']

async function loadChordDB() {
    if (!CHORD_DB) {
        const response = await fetch("assets/chords.json");
        CHORD_DB = await response.json();
    }
}

function getChord(chordName) {
    if (!CHORD_DB) return null;

    chordName = chordName.replace("♯", "#");

    // Split root and suffix
    const root = rootsOrdered.find((r) => chordName.startsWith(r))
    const suffix = chordName.slice(root.length);

    // Get root entry
    const enharmonicRoots = { Bb: 'A#', Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#' };
    const canonicalRoot = enharmonicRoots[root] || root;
    const rootEntry = CHORD_DB[canonicalRoot];
    if (!rootEntry) return null;

    // Get suffix variants
    const variants = rootEntry[suffix];
    if (!variants || !Array.isArray(variants) || variants.length === 0) return null;

    // Select the first variant
    // In the future, we might show all the variants
    const variant = variants[0];

    // Add barres, if not present - otherwise SVGuitar dies
    if (!variant.hasOwnProperty("barres")) {
        variant.barres = [];
    }

    return variant;
}

function getSongChords() {
    const chords = new Set();
    document.querySelectorAll('.cp-chord').forEach(el => {
        chords.add(el.textContent);
    });
    return Array.from(chords);
}

function renderChordDiagram(container, chordName) {
    const cacheKey = "diagram_" + chordName;

    // Use cached SVG if available
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
        container.innerHTML = cached;
        return;
    }

    // Get chord from DB
    const chord = getChord(chordName);
    if (!chord) {
        container.textContent = "No diagram";
        return;
    }

    // Draw the chord diagram
    new svguitar.SVGuitarChord(container)
        .chord(chord)
        .configure({
            frets: 4,
            tuning: ['E', 'A', 'D', 'G', 'B', 'e'],

            fretLabelPosition: 'right',
            fixedDiagramPosition: true,
            showFretMarkers: true,

            fingerSize: 0.9,
            barreChordRadius: 0.6,

            sidePadding: 0.20,
            tuningsFontSize: 25,
        })
        .draw()

    // Cache the SVG
    const svg = container.innerHTML;
    sessionStorage.setItem(cacheKey, svg);
}

async function populateChordsBox() {
    const transpose = currentTranspose;

    // If already rendered and same transposition, skip
    if (renderedTransposition === transpose) {
        return;
    }

    await loadChordDB();

    const chordsBox = document.getElementById("chords-box");

    // Clear old diagrams
    chordsBox.innerHTML = "";

    const chords = getSongChords();

    // Render new diagrams
    chords.forEach(chord => {
        const wrapper = document.createElement("div");
        wrapper.className = "chord-diagram-wrap";

        const label = document.createElement("div");
        label.className = "chord-diagram-label";
        label.textContent = chord;

        renderChordDiagram(wrapper, chord);
        wrapper.appendChild(label)

        chordsBox.appendChild(wrapper);
    });

    // Save state
    renderedTransposition = transpose;
}

function resetChordDiagrams() {
    renderedTransposition = null;

    const chordsBox = document.getElementById("chords-box");
    chordsBox.innerHTML = "";
}

function setupChords() {
    const chordsToggleBtn = document.getElementById("chords-toggle");
    const chordsBox = document.getElementById("chords-box");

    chordsToggleBtn.addEventListener("click", () => {
        populateChordsBox();
        chordsBox.classList.toggle("hidden");
    });

    document.addEventListener("click", (event) => {
        if (
            !chordsBox.contains(event.target) &&
            !chordsToggleBtn.contains(event.target)
        ) {
            chordsBox.classList.add("hidden");
        }
    });
}

// Guitar tuner ---------------------------------------------------------------
// Tuner configuration (keep minimal and centralized)
const GUITAR_TUNER_SETTINGS = {
    referenceFrequency: 440,
    rmsThreshold: 0.01,
    autocorrelateThreshold: 0.002,
    fftSize: 2048,
    minClosenessWidthPercent: 20,
    listeningColor: "#888",
    goodColor: "#4caf50",
    okColor: "#f4b400",
    badColor: "#d62828",
};

const TUNER_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const TUNER_INSTRUMENTS = {
    guitar: {
        name: "Guitar",
        strings: ["E2", "A2", "D3", "G3", "B3", "E4"],
    },
    bass: {
        name: "Bass",
        strings: ["E1", "A1", "D2", "G2"],
    },
    ukulele: {
        name: "Ukulele",
        strings: ["G4", "C4", "E4", "A4"],
    },
    violin: {
        name: "Violin",
        strings: ["G3", "D4", "A4", "E5"],
    },
    cello: {
        name: "Cello",
        strings: ["C2", "G2", "D3", "A3"],
    },
    banjo: {
        name: "Banjo",
        strings: ["G4", "D3", "G3", "B3", "D4"],
    },
    mandolin: {
        name: "Mandolin",
        strings: ["G3", "D4", "A4", "E5"],
    },
    chromatic: {
        name: "Chromatic",
        strings: [],
    },
};

function noteStringToFrequency(noteString, referenceFrequency = GUITAR_TUNER_SETTINGS.referenceFrequency) {
    const match = /^([A-G]#?)(\d+)$/.exec(noteString);
    if (!match) return null;
    const note = match[1];
    const octave = Number(match[2]);
    const noteIndex = TUNER_NOTE_NAMES.indexOf(note);
    if (noteIndex === -1) return null;

    const semitoneFromA4 = noteIndex - 9 + (octave - 4) * 12;
    return referenceFrequency * Math.pow(2, semitoneFromA4 / 12);
}

function buildInstrumentFrequencies() {
    Object.keys(TUNER_INSTRUMENTS).forEach((key) => {
        const instrument = TUNER_INSTRUMENTS[key];
        instrument.stringFrequencies = instrument.strings.map((name) => ({
            name,
            frequency: noteStringToFrequency(name),
        }));
    });
}

buildInstrumentFrequencies();

const GuitarTuner = (function () {
    const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

    let audioContext = null;
    let analyser = null;
    let sourceNode = null;
    let mediaStream = null;
    let rafId = null;
    let progressElement = null;
    let onUpdateCallback = null;
    let referenceFrequency = GUITAR_TUNER_SETTINGS.referenceFrequency;
    let currentInstrumentKey = 'guitar';
    let lastProgressUpdateTime = 0;
    const progressUpdateThrottleMs = 100;
    let currentInstrument = TUNER_INSTRUMENTS[currentInstrumentKey];

    const state = {
        isListening: false,
        frequency: null,
        note: null,
        octave: null,
        cents: null,
        nearestString: null,
        nearestStringCents: null,
        closeness: 0,
    };

    function setInstrument(key) {
        if (key && key in TUNER_INSTRUMENTS) {
            currentInstrumentKey = key;
            currentInstrument = TUNER_INSTRUMENTS[key];
        }
    }

    function getNearestTarget(frequency) {
        if (!frequency || frequency <= 0 || !currentInstrument || !currentInstrument.stringFrequencies?.length) {
            return null;
        }

        const nearest = currentInstrument.stringFrequencies.reduce((best, string) => {
            const diffCents = Math.round(1200 * Math.log2(frequency / string.frequency));
            const distance = Math.abs(diffCents);
            if (!best || distance < best.distance) {
                return {
                    stringName: string.name,
                    stringFrequency: string.frequency,
                    cents: diffCents,
                    distance,
                };
            }
            return best;
        }, null);

        if (!nearest) {
            return null;
        }

        return nearest;
    }

    function setProgressElementById(elementId) {
        progressElement = document.getElementById(elementId);
        notifyUpdate();
    }

    function updateProgressElement() {
        if (!progressElement) {
            return;
        }

        const now = Date.now();
        if (state.isListening && state.frequency && now - lastProgressUpdateTime < progressUpdateThrottleMs) {
            return;
        }
        lastProgressUpdateTime = now;
    }

    function notifyUpdate() {
        if (typeof onUpdateCallback === "function") {
            onUpdateCallback({ ...state });
        }
        updateProgressElement();
    }

    function getClosestNote(frequency) {
        if (!frequency || frequency <= 0) {
            return null;
        }

        const noteNumber = 12 * Math.log2(frequency / referenceFrequency) + 49;
        const rounded = Math.round(noteNumber);
        const cents = Math.round((noteNumber - rounded) * 100);
        const noteIndex = ((rounded + 11) % 12 + 12) % 12;
        const octave = Math.floor((rounded + 8) / 12);

        return {
            note: NOTE_NAMES[noteIndex],
            octave,
            cents,
        };
    }

    function autoCorrelate(buffer, sampleRate) {
        const size = buffer.length;
        let sum = 0;
        for (let i = 0; i < size; i += 1) {
            const value = buffer[i];
            sum += value * value;
        }

        const rms = Math.sqrt(sum / size);
        if (rms < GUITAR_TUNER_SETTINGS.rmsThreshold) {
            return -1;
        }

        let r1 = 0;
        let r2 = size - 1;
        const threshold = GUITAR_TUNER_SETTINGS.autocorrelateThreshold;

        for (let i = 0; i < size / 2; i += 1) {
            if (Math.abs(buffer[i]) < threshold) {
                r1 = i;
                break;
            }
        }

        for (let i = 1; i < size / 2; i += 1) {
            if (Math.abs(buffer[size - i]) < threshold) {
                r2 = size - i;
                break;
            }
        }

        const trimmed = buffer.slice(r1, r2);
        const trimmedSize = trimmed.length;
        if (trimmedSize < 2) {
            return -1;
        }

        const correlation = new Array(trimmedSize).fill(0);
        for (let lag = 0; lag < trimmedSize; lag += 1) {
            for (let i = 0; i + lag < trimmedSize; i += 1) {
                correlation[lag] += trimmed[i] * trimmed[i + lag];
            }
        }

        let d = 0;
        while (d < trimmedSize - 1 && correlation[d] > correlation[d + 1]) {
            d += 1;
        }

        let bestLag = -1;
        let bestVal = -Infinity;
        for (let i = d; i < trimmedSize; i += 1) {
            if (correlation[i] > bestVal) {
                bestVal = correlation[i];
                bestLag = i;
            }
        }

        if (bestLag <= 0) {
            return -1;
        }

        const x1 = correlation[bestLag - 1] || 0;
        const x2 = correlation[bestLag];
        const x3 = correlation[bestLag + 1] || 0;
        const a = (x1 + x3 - 2 * x2) / 2;
        const b = (x3 - x1) / 2;
        const shift = a ? b / (2 * a) : 0;

        return sampleRate / (bestLag + shift);
    }

    function analyze() {
        if (!analyser || !audioContext) {
            return;
        }

        const buffer = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(buffer);

        const frequency = autoCorrelate(buffer, audioContext.sampleRate);
        if (frequency > 0) {
            const note = getClosestNote(frequency);
            const nearest = getNearestTarget(frequency);

            state.frequency = Math.round(frequency * 100) / 100;
            state.note = note.note;
            state.octave = note.octave;
            state.cents = note.cents;

            if (nearest) {
                state.nearestString = nearest.stringName;
                state.nearestStringCents = nearest.cents;
                state.closeness = Math.max(0, Math.min(100, 100 - Math.abs(nearest.cents)));
            } else {
                state.nearestString = null;
                state.nearestStringCents = null;
                state.closeness = Math.max(0, Math.min(100, 100 - Math.abs(note.cents)));
            }
        } else {
            state.frequency = null;
            state.note = null;
            state.octave = null;
            state.cents = null;
            state.nearestString = null;
            state.nearestStringCents = null;
            state.closeness = 0;
        }

        notifyUpdate();
        rafId = requestAnimationFrame(analyze);
    }

    async function start() {
        if (state.isListening) {
            return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error("Microphone access is not supported by this browser.");
            return;
        }

        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = GUITAR_TUNER_SETTINGS.fftSize;
            sourceNode = audioContext.createMediaStreamSource(mediaStream);
            sourceNode.connect(analyser);

            state.isListening = true;
            notifyUpdate();
            analyze();
        } catch (error) {
            console.error("Unable to start tuner:", error);
            state.isListening = false;
            notifyUpdate();
        }
    }

    function stop() {
        if (!state.isListening) {
            return;
        }

        cancelAnimationFrame(rafId);
        rafId = null;

        if (sourceNode) {
            try {
                sourceNode.disconnect();
            } catch (err) {
                // ignore
            }
            sourceNode = null;
        }

        if (analyser) {
            try {
                analyser.disconnect();
            } catch (err) {
                // ignore
            }
            analyser = null;
        }

        if (mediaStream) {
            mediaStream.getTracks().forEach((track) => track.stop());
            mediaStream = null;
        }

        if (audioContext) {
            audioContext.close().catch(() => {});
            audioContext = null;
        }

        state.isListening = false;
        state.frequency = null;
        state.note = null;
        state.octave = null;
        state.cents = null;
        notifyUpdate();
    }

    function init(options = {}) {
        if (options.progressElementId) {
            setProgressElementById(options.progressElementId);
        }

        if (typeof options.onUpdate === "function") {
            onUpdateCallback = options.onUpdate;
        }

        if (typeof options.referenceFrequency === "number" && options.referenceFrequency > 0) {
            referenceFrequency = options.referenceFrequency;
        }

        if (typeof options.instrument === "string") {
            setInstrument(options.instrument);
        }

        notifyUpdate();
    }

    function setOnUpdate(callback) {
        onUpdateCallback = typeof callback === "function" ? callback : null;
    }

    function setReferenceFrequency(value) {
        if (typeof value === "number" && value > 0) {
            referenceFrequency = value;
        }
    }

    function isListening() {
        return state.isListening;
    }

    function getState() {
        return { ...state };
    }

    return {
        init,
        start,
        stop,
        setProgressElementById,
        setOnUpdate,
        setReferenceFrequency,
        setInstrument,
        isListening,
        getState,
    };
}());

function setupTuner() {
    const tunerToggleBtn = document.getElementById('tuner-toggle');
    const tunerToggleIcon = tunerToggleBtn?.querySelector('i');
    const tunerBox = document.getElementById('tuner-box');
    const tunerInstrumentSelect = document.getElementById('tuner-instrument');
    const tunerTargetNote = document.getElementById('tuner-target-note');
    const tunerProgressLabel = document.getElementById('tuner-progress-label');
    const tunerBarMarker = document.getElementById('tuner-bar-marker');
    const tunerBarFill = document.getElementById('tuner-bar-fill');

    if (!tunerToggleBtn || !tunerBox || !tunerInstrumentSelect || !tunerTargetNote || !tunerProgressLabel || !tunerBarMarker || !tunerBarFill) return;

    let latestTunerState = null;
    let uiRenderScheduled = false;
    let lastUiRenderTime = 0;
    const uiRenderThrottleMs = 90;

    function renderTunerUI(timestamp) {
        uiRenderScheduled = false;
        if (!latestTunerState) {
            return;
        }

        if (timestamp - lastUiRenderTime < uiRenderThrottleMs) {
            scheduleTunerUI();
            return;
        }
        lastUiRenderTime = timestamp;

        const s = latestTunerState;
        const targetNote = s.nearestString || (s.note ? `${s.note}${s.octave}` : '-');
        tunerTargetNote.textContent = targetNote;

        const centsValue = s.nearestStringCents !== null ? s.nearestStringCents : (s.cents || 0);
        const markerPercent = Math.max(0, Math.min(100, 50 + centsValue));
        tunerBarMarker.style.left = `${markerPercent}%`;

        tunerBarFill.classList.remove('good', 'ok', 'bad');
        if (s.nearestString) {
            const closeness = Math.max(0, Math.min(100, 100 - Math.abs(centsValue)));
            tunerBarFill.classList.add(closeness > 90 ? 'good' : closeness > 60 ? 'ok' : 'bad');
        }

        if (s.isListening && s.frequency) {
            const centsText = centsValue >= 0 ? `+${centsValue}` : `${centsValue}`;
            tunerProgressLabel.textContent = `${centsText}¢`;
        } else {
            tunerProgressLabel.textContent = '-';
        }

        if (tunerToggleIcon) {
            tunerToggleIcon.className = s.isListening ? 'bi bi-mic-fill' : 'bi bi-mic';
        }

        tunerTargetNote.classList.toggle('tuned', s.closeness > 90);
    }

    function scheduleTunerUI() {
        if (uiRenderScheduled) {
            return;
        }
        uiRenderScheduled = true;
        requestAnimationFrame(renderTunerUI);
    }

    GuitarTuner.init({ progressElementId: 'tuner-bar-fill', instrument: tunerInstrumentSelect.value });
    GuitarTuner.setOnUpdate((s) => {
        latestTunerState = s;
        scheduleTunerUI();
    });

    tunerInstrumentSelect.addEventListener('change', (event) => {
        const instrument = event.target.value;
        GuitarTuner.setInstrument(instrument);
        GuitarTuner.init({ progressElementId: 'tuner-bar-fill', instrument });
    });

    tunerToggleBtn.addEventListener('click', (event) => {
        const turningOn = !GuitarTuner.isListening();
        if (turningOn) {
            tunerBox.classList.remove('hidden');
            GuitarTuner.start();
        } else {
            tunerBox.classList.add('hidden');
            GuitarTuner.stop();
        }
    });

    document.addEventListener('click', (event) => {
        if (!tunerBox.contains(event.target) &&
            !tunerToggleBtn.contains(event.target))
        {
            tunerBox.classList.add('hidden');
            GuitarTuner.stop();
        }
    });
}

// Lightmode Darkmode ---------------------------------------------------------

function setupDarkmode() {
    const darkmodeToggleBtn = document.getElementById("darkmode-toggle");

    const icon = () => darkmodeToggleBtn.querySelector('i');

    darkmodeToggleBtn.addEventListener("click", () => {
        document.body.classList.toggle("darkmode");
        if (document.body.classList.contains('darkmode')) {
            if (icon()) icon().className = 'bi bi-sun';
        } else {
            if (icon()) icon().className = 'bi bi-moon';
        }
    });
}

// Search ---------------------------------------------------------------------

function buildSearchIndex() {
    songSearchMap = {};
    const records = songsIds.map((id) => {
        const song = songs[id] || {};
        const title = song.title || "";
        const artist = song.artist || "";
        const combined = `${title} ${artist}`.trim();
        songSearchMap[combined] = id;
        return {
            id,
            title,
            artist,
            combined,
        };
    });

    searchFuse = new Fuse(records, {
        keys: ["combined", "title", "artist"],
        threshold: 0.35,
        ignoreLocation: true,
        ignoreDiacritics: true,
    });
}

function searchSongs(query) {
    const text = String(query || "").trim();
    if (!text) {
        return songsIds.slice();
    }

    if (!searchFuse) {
        buildSearchIndex();
    }

    const results = searchFuse.search(text);
    return results.map((result) => result.item.id);
}

function renderSearchResults(songIds) {
    const wrapper = document.getElementById("search-results-list");
    if (!wrapper) return;

    wrapper.innerHTML = "";

    songIds.forEach((id) => {
        const song = songs[id];
        if (!song) return;

        const item = document.createElement("a");
        item.href = `#${id}`;
        item.className = "search-result-item";
        item.innerHTML = `
            <span class="index-song-title">${song.title}</span>
            ${song.artist ? `<span class="index-song-artist">${song.artist}</span>` : ""}
        `;

        wrapper.appendChild(item);
    });
}

function setupSearch() {
    const searchToggleBtn = document.getElementById("search-toggle");
    const searchResults = document.getElementById("search-results");
    const searchInput = document.getElementById("search-input");
    const indexSongs = document.getElementById("index-songs");

    if (!searchToggleBtn || !searchResults || !searchInput) return;

    buildSearchIndex();
    renderSearchResults(searchSongs(""));

    searchToggleBtn.addEventListener("click", () => {
        searchResults.classList.toggle("hidden");
        indexSongs.classList.toggle("hidden");
        if (!searchResults.classList.contains("hidden")) {
            searchInput.focus();
            renderSearchResults(searchSongs(searchInput.value));
        }
    });

    searchInput.addEventListener("input", (event) => {
        renderSearchResults(searchSongs(event.target.value));
    });

    document.addEventListener("click", (event) => {
        if (
            !searchResults.contains(event.target) &&
            !searchToggleBtn.contains(event.target)
        ) {
            if (!searchResults.classList.contains("hidden")) {
                searchResults.classList.add("hidden");
                indexSongs.classList.remove("hidden");
            }
        }
    });
}

// Search ---------------------------------------------------------------------

function setupRandomSong() {
    const randomSongBtn = document.getElementById("random-song");

    randomSongBtn.addEventListener("click", () => {
        const randomSongIndex = Math.floor(Math.random() * songsIds.length);
        currentSongIndex = randomSongIndex;
        loadCurrentSong();
    });
}
