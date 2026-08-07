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
    document.getElementById("song-content").innerHTML = song.content;
    document.title = song.title;

    currentSongIndex = songIdsIndices[id];
}

function loadCurrentSong() {
    loadSong(songsIds[currentSongIndex]);
    transposeReset();
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
