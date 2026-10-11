// Run with: node --experimental-detect-module --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";

import { dragOffset, isSwipe, lockAxis } from "../web/js/swipe.js";

test("a drag has no direction until the finger has moved a little", () => {
    assert.equal(lockAxis(3, -4), null);
});

test("the larger movement decides the direction", () => {
    assert.equal(lockAxis(14, 5), "x");
    assert.equal(lockAxis(-14, 5), "x");
    assert.equal(lockAxis(5, -14), "y");
});

test("a long drag is a swipe however slow", () => {
    assert.equal(isSwipe(-120, 3000, 390), true);
    assert.equal(isSwipe(120, 3000, 390), true);
});

test("a short, slow drag springs back", () => {
    assert.equal(isSwipe(-60, 800, 390), false);
});

test("a short drag is a swipe when it is a quick flick", () => {
    assert.equal(isSwipe(-50, 80, 390), true);
    assert.equal(isSwipe(-20, 20, 390), false);
});

test("on a narrow screen a third of the width is far enough", () => {
    assert.equal(isSwipe(-90, 2000, 240), true);
    assert.equal(isSwipe(-70, 2000, 240), false);
});

test("the song follows the finger but never leaves the screen", () => {
    assert.equal(dragOffset(-50, 390), -50);
    assert.equal(dragOffset(900, 390), 390);
    assert.equal(dragOffset(-900, 390), -390);
});
