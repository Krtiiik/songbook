// Run: node --experimental-detect-module --test tests/theme.test.mjs

import assert from "node:assert/strict";
import { test } from "node:test";

import { parseThemeChoice, resolveTheme } from "../web/js/theme.js";

test("a stored light, dark or system is kept", () => {
    assert.equal(parseThemeChoice("light"), "light");
    assert.equal(parseThemeChoice("dark"), "dark");
    assert.equal(parseThemeChoice("system"), "system");
});

test("nothing stored or an unknown value means system", () => {
    assert.equal(parseThemeChoice(null), "system");
    assert.equal(parseThemeChoice(undefined), "system");
    assert.equal(parseThemeChoice("sepia"), "system");
});

test("an explicit choice ignores the device", () => {
    assert.equal(resolveTheme("light", true), "light");
    assert.equal(resolveTheme("dark", false), "dark");
});

test("system follows the device", () => {
    assert.equal(resolveTheme("system", true), "dark");
    assert.equal(resolveTheme("system", false), "light");
});
