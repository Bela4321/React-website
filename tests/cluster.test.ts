import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hdbscan, cutToK, splitNode, mergeNode, maxClusters, labelsFor } from "../src/lib/cluster/hdbscan.ts";
import { symmetricEigen, gramDense, gramSparse, pcaFromGram } from "../src/lib/cluster/pca.ts";
import { tfidf, clusterKeywords, stem } from "../src/lib/cluster/text.ts";
import { clusterVectors, clusterTexts, adjustedRand } from "../src/lib/cluster/pipeline.ts";

const ref = JSON.parse(readFileSync(new URL("./fixtures/sklearn-reference.json", import.meta.url), "utf8"));

test("eigen decomposition reconstructs the matrix", () => {
  const a = [[4, 1, 2], [1, 3, 0], [2, 0, 5]].map((r) => Float64Array.from(r));
  const { values, vectors } = symmetricEigen(a);
  assert.ok(values[0] >= values[1] && values[1] >= values[2]);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    let s = 0;
    for (let k = 0; k < 3; k++) s += values[k] * vectors[k][i] * vectors[k][j];
    assert.ok(Math.abs(s - a[i][j]) < 1e-9);
  }
});

test("PCA keeps distances when all variance is kept, and sparse Gram equals dense", () => {
  const rows = [[1, 0, 2], [0, 1, 1], [3, 1, 0], [1, 1, 1]];
  const scores = pcaFromGram(gramDense(rows), 1, 3);
  const d = (x: number[], y: number[]) => Math.hypot(...x.map((v, i) => v - y[i]));
  assert.ok(Math.abs(d(scores[0], scores[2]) - d(rows[0], rows[2])) < 1e-9);
  const sparse = rows.map((r) => new Map(r.map((v, j) => [j, v] as [number, number]).filter(([, v]) => v)));
  const gs = gramSparse(sparse);
  const gd = gramDense(rows);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) assert.ok(Math.abs(gs[i][j] - gd[i][j]) < 1e-9);
});

test("HDBSCAN matches scikit-learn on blobs with noise", () => {
  const r = hdbscan(ref.blobs.points, { minClusterSize: 5, minSamples: 1, maxClusterSize: 80 });
  const ari = adjustedRand(r.labels, ref.blobs.labels);
  assert.ok(ari > 0.95, `ARI ${ari}`);
  assert.equal(r.selected.length, new Set(ref.blobs.labels.filter((l: number) => l >= 0)).size);
});

test("the thesis pipeline matches scikit-learn on real Qwen3 embeddings", () => {
  const raw = new Int16Array(Uint8Array.from(Buffer.from(ref.real.embeddings, "base64")).buffer);
  const vectors = Array.from({ length: ref.real.n }, (_, i) => Float64Array.from(raw.subarray(i * ref.real.dims, (i + 1) * ref.real.dims), (x) => x / 1e4));
  const r = clusterVectors(vectors);
  assert.equal(r.reduced[0].length, ref.real.pcaComponents);
  const ari = adjustedRand(r.labels, ref.real.labels);
  assert.ok(ari > 0.99, `ARI ${ari}`);
});

test("tree cuts: k clusters, split and merge stay consistent", () => {
  const r = hdbscan(ref.blobs.points);
  assert.deepEqual(cutToK(r.nodes, r.root, 1), [r.root]);
  const max = maxClusters(r.nodes);
  for (let k = 1; k <= max; k++) {
    const shown = cutToK(r.nodes, r.root, k);
    assert.equal(shown.length, k);
    // shown clusters never overlap
    const labels = labelsFor(r.nodes, shown, ref.blobs.points.length);
    const covered = labels.filter((l) => l >= 0).length;
    const total = shown.reduce((s, id) => s + r.nodes.get(id)!.points.length, 0);
    assert.equal(covered, total);
  }
  const two = cutToK(r.nodes, r.root, 2);
  const split = splitNode(r.nodes, r.root, two, two[0]);
  assert.ok(split.length >= 2);
  const merged = mergeNode(r.nodes, r.root, split, r.nodes.get(two[0])!.children[0] ?? two[0]);
  assert.deepEqual(merged, two);
});

test("TF-IDF rows are unit length, stems join word forms", () => {
  assert.equal(stem("networks"), stem("network"));
  assert.equal(stem("clustering"), stem("clustered"));
  const { rows } = tfidf(["Neural networks cluster images", "Clustering of neural network embeddings", "Gut microbiome and depression"]);
  for (const r of rows) assert.ok(Math.abs(Math.hypot(...r.values()) - 1) < 1e-9);
});

test("cluster keywords name each group and skip the query words", () => {
  const docs = [
    "gut microbiome depression serotonin", "gut microbiome depression serotonin axis", "gut microbiome anxiety serotonin",
    "gut microbiome obesity diet fiber", "gut microbiome obesity diet", "gut microbiome diet fiber weight",
  ];
  const [a, b] = clusterKeywords(docs, [[0, 1, 2], [3, 4, 5]], ["gut microbiome"]);
  assert.ok(a.includes("serotonin") && !a.includes("microbiome"), a.join());
  assert.ok(b.includes("diet") || b.includes("obesity"), b.join());
});

test("TF-IDF baseline runs end to end", () => {
  const topics = ["quantum error correction qubits surface code", "protein folding structure prediction", "gut bacteria depression brain"];
  const docs = Array.from({ length: 30 }, (_, i) => `${topics[i % 3]} sample ${i % 7} variant`);
  const r = clusterTexts(docs);
  assert.ok(r.selected.length >= 2, String(r.selected.length));
});
