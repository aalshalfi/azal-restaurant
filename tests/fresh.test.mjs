// Owner ruling 2026-11-27: pickup choices are plain times; no example "Fresh" slot or note.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

test("owner ruling: every pickup slot is a plain time with no Fresh badge or explanatory note", () => {
  assert.doesNotMatch(js, /pickupFresh(?:Note|Long|Short)|freshExample|isFresh|fresh-tag|fresh-note|pickup-slot is-fresh/);
  assert.match(js, /shown\.map\(m=>radio\(String\(m\),fmtMin\(m\),"pickup-slot"\)\)\.join\(""\)/);
  assert.doesNotMatch(css, /fresh-tag|fresh-note|pickup-slot\.is-fresh|Fresh from the oven/i);
});
