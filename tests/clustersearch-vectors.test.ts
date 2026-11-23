import { test } from "node:test";
import assert from "node:assert/strict";
import { looksLikeQuestion, packVectors, prepareVector, unpackVectors } from "../worker/clustersearch/vectors.ts";

test("questions vs keyword queries", () => {
  assert.ok(looksLikeQuestion("How do gut bacteria affect depression?"));
  assert.ok(looksLikeQuestion("which methods cluster search results best"));
  assert.ok(!looksLikeQuestion("protein folding"));
  assert.ok(!looksLikeQuestion("quantum error correction surface codes"));
});

test("vectors survive the int8 round trip with cosine similarity > 0.999", () => {
  const rand = () => Array.from({ length: 1024 }, () => Math.random() * 2 - 1);
  const rows = [rand(), rand(), rand()].map((v) => prepareVector(v, 512));
  assert.equal(rows[0].length, 512);
  assert.ok(Math.abs(Math.hypot(...rows[0]) - 1) < 1e-9);
  const back = unpackVectors(packVectors(rows, 512));
  assert.equal(back.length, 3);
  for (let i = 0; i < 3; i++) {
    const cos = rows[i].reduce((s, x, j) => s + x * back[i][j], 0);
    assert.ok(cos > 0.999, String(cos));
  }
});
