// Chord diagrams ---------------------------------------------------------------
// Diagrams come from chords.json ({root: {suffix: [variants]}}, sharp roots only)
// and are drawn with SVGuitar (global `svguitar`, loaded by a classic script tag).

import { noteSemitone, parseChord } from "./transpose.js";

const DB_ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

let chordDb = null;

async function loadChordDb() {
    chordDb ??= await fetch("chords.json").then((response) => response.json());
    return chordDb;
}

// Other spellings of suffixes in chords.json
const SUFFIX_ALIASES = { maj: "", mi: "m", min: "m", "+": "aug", "7maj": "maj7", "mi7": "m7" };

function findDiagram(chordName) {
    const chord = parseChord(chordName);
    if (!chord) return null;

    const entry = chordDb[DB_ROOTS[noteSemitone(chord.root)]];
    const suffix = SUFFIX_ALIASES[chord.suffix] ?? chord.suffix;
    const bassSemitone = chord.bass === null ? null : noteSemitone(chord.bass);

    // Slash chord if there is a diagram for it, the plain chord otherwise
    const candidates = bassSemitone === null ? [suffix] : [`${suffix}/${DB_ROOTS[bassSemitone]}`, suffix];
    const variants = candidates.map((key) => entry?.[key]).find((v) => Array.isArray(v) && v.length > 0);
    if (!variants) return null;

    // First variant only; SVGuitar requires `barres`
    return { barres: [], ...variants[0] };
}

function drawDiagram(container, chordName) {
    const chord = findDiagram(chordName);
    if (!chord) {
        container.append(Object.assign(document.createElement("div"), {
            className: "chord-diagram-missing",
            textContent: "?",
        }));
        return;
    }

    new svguitar.SVGuitarChord(container)
        .chord(chord)
        .configure({
            frets: 4,
            tuning: ["E", "A", "D", "G", "B", "e"],
            fretLabelPosition: "right",
            fixedDiagramPosition: true,
            showFretMarkers: true,
            fingerSize: 0.9,
            barreChordRadius: 0.6,
            sidePadding: 0.2,
            tuningsFontSize: 25,
        })
        .draw();
}

/** Fill the box with diagrams of the given chords (as currently displayed, i.e. transposed). */
export async function renderChordDiagrams(box, chordNames) {
    await loadChordDb();
    box.replaceChildren();

    for (const name of chordNames) {
        const wrapper = document.createElement("div");
        wrapper.className = "chord-diagram";
        drawDiagram(wrapper, name);

        const label = document.createElement("div");
        label.className = "chord-diagram-label";
        label.textContent = name;
        wrapper.append(label);

        box.append(wrapper);
    }
}
