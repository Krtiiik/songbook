// Run with: node --experimental-detect-module --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";

import { groupByLetter, letterOf } from "../web/js/letters.js";

test("plain letters are upper-cased", () => {
    assert.equal(letterOf("ach synku"), "A");
    assert.equal(letterOf("Jožin z bažin"), "J");
});

test("č ř š ž are sections of their own, other accents fold into the plain letter", () => {
    assert.equal(letterOf("Čechomor"), "Č");
    assert.equal(letterOf("řeka"), "Ř");
    assert.equal(letterOf("Šla"), "Š");
    assert.equal(letterOf("Žába"), "Ž");
    assert.equal(letterOf("Éra"), "E");
    assert.equal(letterOf("Úsvit"), "U");
});

test("ch is a section after h, not part of c", () => {
    assert.equal(letterOf("Chata"), "Ch");
    assert.equal(letterOf("chodník"), "Ch");
    assert.equal(letterOf("Cesta"), "C");
});

test("digits, symbols and empty titles go under #", () => {
    assert.equal(letterOf("7 dní"), "#");
    assert.equal(letterOf("♪♪"), "#");
    assert.equal(letterOf(""), "#");
});

test("leading punctuation is skipped", () => {
    assert.equal(letterOf("„Ahoj“"), "A");
    assert.equal(letterOf("(Ne)hledej"), "N");
    assert.equal(letterOf("…Chvíle"), "Ch");
});

test("groups consecutive songs with the same letter, in order", () => {
    const songs = [{ title: "Ach" }, { title: "Ale" }, { title: "Čas" }, { title: "Dům" }, { title: "Chata" }];
    const groups = groupByLetter(songs);
    assert.deepEqual(groups.map((g) => g.letter), ["A", "Č", "D", "Ch"]);
    assert.deepEqual(groups[0].songs.map((s) => s.title), ["Ach", "Ale"]);
});

test("no songs give no groups", () => {
    assert.deepEqual(groupByLetter([]), []);
});
