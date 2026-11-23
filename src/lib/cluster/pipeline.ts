// The thesis pipeline: PCA down to 40 % of the variance, then HDBSCAN
// (min_cluster_size 5, min_samples 1, max_cluster_size 80).

import { hdbscan, type HdbscanResult } from "./hdbscan.ts";
import { gramDense, gramSparse, pcaFromGram, type Vector } from "./pca.ts";
import { tfidf } from "./text.ts";

export const THESIS = { variance: 0.4, minClusterSize: 5, minSamples: 1, maxClusterSize: 80 };

export function clusterVectors(vectors: Vector[]): HdbscanResult & { reduced: number[][] } {
  const reduced = pcaFromGram(gramDense(vectors), THESIS.variance);
  return { ...hdbscan(reduced, THESIS), reduced };
}

export function clusterTexts(docs: string[]): HdbscanResult & { reduced: number[][] } {
  const reduced = pcaFromGram(gramSparse(tfidf(docs).rows), THESIS.variance);
  return { ...hdbscan(reduced, THESIS), reduced };
}

/** Adjusted Rand index between two labelings (noise -1 counted as its own label), for tests and comparisons. */
export function adjustedRand(a: number[], b: number[]): number {
  const n = a.length;
  const table = new Map<string, number>();
  const ca = new Map<number, number>();
  const cb = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    const k = `${a[i]}|${b[i]}`;
    table.set(k, (table.get(k) ?? 0) + 1);
    ca.set(a[i], (ca.get(a[i]) ?? 0) + 1);
    cb.set(b[i], (cb.get(b[i]) ?? 0) + 1);
  }
  const c2 = (x: number) => (x * (x - 1)) / 2;
  let index = 0;
  for (const v of table.values()) index += c2(v);
  let sa = 0;
  for (const v of ca.values()) sa += c2(v);
  let sb = 0;
  for (const v of cb.values()) sb += c2(v);
  const expected = (sa * sb) / c2(n);
  const max = (sa + sb) / 2;
  return max === expected ? 1 : (index - expected) / (max - expected);
}
