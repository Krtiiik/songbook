// Chord parsing and transposition ---------------------------------------------
// A chord is root + suffix + optional /bass. The suffix is kept verbatim, so any
// chord quality survives (C7b9, Em7add11, ...). Anything that isn't a chord
// (N.C., x, (2×)) is left alone.

const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11, H: 11 };
const ACCIDENTALS = { "": 0, "#": 1, "♯": 1, "b": -1, "♭": -1 };

// Note names guitarists usually read: sharps for C#/F#/G#, flats for Eb/Bb
const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];

const NOTE = /^([A-H])([#♯b♭]?)$/;
const CHORD = /^([A-H])([#♯b♭]?)([^/]*)(?:\/(.+))?$/;

/** Semitone (0-11) of a note name, or null. */
export function noteSemitone(note) {
    const match = NOTE.exec(note);
    if (!match) return null;
    return (SEMITONES[match[1]] + ACCIDENTALS[match[2]] + 12) % 12;
}

/** Split a chord into { root, suffix, bass }, or null if it isn't a chord. */
export function parseChord(chord) {
    const match = CHORD.exec(chord.trim());
    if (!match) return null;
    return { root: match[1] + match[2], suffix: match[3], bass: match[4] ?? null };
}

function transposeNote(note, semitones) {
    const semitone = noteSemitone(note);
    if (semitone === null) return note;
    return NOTE_NAMES[(((semitone + semitones) % 12) + 12) % 12];
}

/** Transpose a chord by a number of semitones. Unknown chords come back unchanged. */
export function transposeChord(chord, semitones) {
    if (semitones % 12 === 0) return chord;
    const parsed = parseChord(chord);
    if (!parsed) return chord;

    const root = transposeNote(parsed.root, semitones);
    const bass = parsed.bass === null ? "" : "/" + transposeNote(parsed.bass, semitones);
    return root + parsed.suffix + bass;
}
