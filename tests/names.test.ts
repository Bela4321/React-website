import { test } from "node:test";
import assert from "node:assert/strict";
import { pickName } from "../src/lib/names.ts";

test("suggests an adjective and an animal", () => {
  assert.match(pickName([]), /^[A-Z][a-z]+ [A-Z][a-z]+$/);
});

test("never suggests a name in use, ignoring case", () => {
  const used = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const n = pickName(used);
    assert.ok(!used.has(n.toLowerCase()));
    used.add(n.toLowerCase());
  }
});

test("appends a number once every pair is taken", () => {
  const all: string[] = [];
  for (let i = 0; i < 2000 && all.length < 28 * 28; i++) {
    const n = pickName(all);
    if (/\d/.test(n)) break;
    all.push(n);
  }
  assert.equal(all.length, 28 * 28);
  assert.match(pickName(all), / \d+$/);
});
