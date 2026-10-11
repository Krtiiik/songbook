// Run with: node --experimental-detect-module --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";

import { clampColumns, maxColumns, nextColumns } from "../web/js/columns.js";

test("phones and small windows get one column", () => {
    assert.equal(maxColumns(390), 1);
    assert.equal(maxColumns(900), 1);
});

test("wider windows fit more columns, up to three", () => {
    assert.equal(maxColumns(1280), 2);
    assert.equal(maxColumns(1920), 3);
    assert.equal(maxColumns(5000), 3);
});

test("a larger text zoom leaves room for fewer columns", () => {
    assert.equal(maxColumns(1920, 1.5), 2);
    assert.equal(maxColumns(1280, 1.5), 1);
});

test("a wanted count is limited to what fits", () => {
    assert.equal(clampColumns(3, 2), 2);
    assert.equal(clampColumns(2, 3), 2);
    assert.equal(clampColumns(0, 3), 1);
});

test("cycling goes up to the limit and wraps to one", () => {
    assert.equal(nextColumns(1, 3), 2);
    assert.equal(nextColumns(3, 3), 1);
    assert.equal(nextColumns(2, 2), 1);
    assert.equal(nextColumns(1, 1), 1);
});
