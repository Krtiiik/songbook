// Run with: node --experimental-detect-module --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";

import { sourceInitial, stackOrder } from "../web/js/versions.js";

test("a source is shown by the first letter of its label", () => {
    assert.equal(sourceInitial("Krtek"), "K");
    assert.equal(sourceInitial("Bratrův zpěvník"), "B");
    assert.equal(sourceInitial("JRadl"), "J");
});

test("the letter is uppercase and survives accents and padding", () => {
    assert.equal(sourceInitial("  řeka"), "Ř");
});

test("a missing label gets a placeholder", () => {
    assert.equal(sourceInitial(""), "?");
    assert.equal(sourceInitial(undefined), "?");
});

test("the current version is at the front of the stack", () => {
    assert.deepEqual(stackOrder(["own", "bratr"], "own"), ["own", "bratr"]);
    assert.deepEqual(stackOrder(["own", "bratr"], "bratr"), ["bratr", "own"]);
});

test("the others follow in list order, wrapping around", () => {
    assert.deepEqual(stackOrder(["own", "bratr", "jradl"], "bratr"), ["bratr", "jradl", "own"]);
    assert.deepEqual(stackOrder(["own", "bratr", "jradl"], "jradl"), ["jradl", "own", "bratr"]);
});

test("an unknown current version leaves the list as it is", () => {
    assert.deepEqual(stackOrder(["own", "bratr"], "missing"), ["own", "bratr"]);
});
