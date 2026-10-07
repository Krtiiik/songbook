// Run with: node --experimental-detect-module --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";

import { parseChord, transposeChord } from "../web/js/transpose.js";

test("keeps the chord suffix", () => {
    assert.equal(transposeChord("C7b9", 2), "D7b9");
    assert.equal(transposeChord("Em7add11", 1), "Fm7add11");
    assert.equal(transposeChord("Dsus4", 2), "Esus4");
});

test("transposes the bass note", () => {
    assert.equal(transposeChord("Bb/D", 1), "B/Eb");
    assert.equal(transposeChord("C♯m7/G#", -1), "Cm7/G");
});

test("leaves non-chords alone", () => {
    for (const text of ["N.C.", "x", "(2×)", ""]) {
        assert.equal(transposeChord(text, 3), text);
    }
    assert.equal(transposeChord("Esus4/7", 2), "F#sus4/7");
});

test("zero and full octaves keep the original spelling", () => {
    assert.equal(transposeChord("A#m", 0), "A#m");
    assert.equal(transposeChord("A#m", 12), "A#m");
});

test("round trip", () => {
    for (const chord of ["C", "Dsus4", "F#m7", "Bb", "G/B", "Hm"]) {
        const back = transposeChord(transposeChord(chord, 5), -5);
        assert.deepEqual(
            [parseChord(back).suffix, parseChord(back).bass],
            [parseChord(chord).suffix, parseChord(chord).bass],
        );
    }
});

test("Czech H is B", () => {
    assert.equal(transposeChord("Hm", 1), "Cm");
});
