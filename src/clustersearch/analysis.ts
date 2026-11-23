// Turns the papers (and their vectors) into everything the three views show:
// the HDBSCAN cluster tree, a 2D map (UMAP), relevance to the question, cluster keywords.

import { UMAP } from "umap-js";
import { hdbscan, type HdbscanResult } from "../lib/cluster/hdbscan.ts";
import { gramDense, gramSparse, pcaFromGram } from "../lib/cluster/pca.ts";
import { tfidf, words, stem } from "../lib/cluster/text.ts";
import { THESIS } from "../lib/cluster/pipeline.ts";
import type { Paper } from "./api.ts";

export type Method = "embedding" | "tfidf";

export interface Analysis {
  method: Method;
  hd: HdbscanResult;
  /** map position per paper, both axes in [0, 1] */
  coords: [number, number][];
  /** 0..1 per paper: how close it is to the question (1 = closest) */
  relevance: number[];
  keywords: (nodeId: number) => string[];
}

const docText = (p: Paper) => `${p.title}. ${p.abstract}`;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cosine = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  let s = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    s += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return s / (Math.sqrt(na * nb) || 1);
};

export function analyse(
  papers: Paper[],
  vectors: (Float32Array | undefined)[],
  queryVector: Float32Array | null,
  query: string,
  method: Method,
): Analysis {
  const docs = papers.map(docText);
  const n = papers.length;

  // 1. the space the clustering works in
  let reduced: number[][];
  let relevance: number[];
  if (method === "embedding") {
    const vs = vectors as Float32Array[];
    reduced = pcaFromGram(gramDense(vs), THESIS.variance);
    relevance = queryVector ? vs.map((v) => cosine(v, queryVector)) : new Array(n).fill(0);
  } else {
    const { rows, vocab } = tfidf([...docs, query]);
    const docRows = rows.slice(0, n);
    reduced = pcaFromGram(gramSparse(docRows), THESIS.variance);
    const q = rows[n];
    relevance = docRows.map((r) => {
      let s = 0;
      for (const [j, x] of q) s += x * (r.get(j) ?? 0);
      return s;
    });
    void vocab;
  }
  const hd = hdbscan(reduced, THESIS);

  // 2. the map: UMAP on the same PCA space the clustering sees, so map and clusters agree
  const mapInput = reduced;
  const umap = new UMAP({
    nComponents: 2,
    nNeighbors: Math.max(2, Math.min(15, n - 1)),
    minDist: 0.12,
    random: mulberry32(42),
  });
  const raw = n >= 4 ? umap.fit(mapInput) : mapInput.map((_, i) => [i, i]);
  const xs = raw.map((p) => p[0]);
  const ys = raw.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const coords = raw.map(([x, y]) => [(x - x0) / (x1 - x0 || 1), (y - y0) / (y1 - y0 || 1)] as [number, number]);

  // 3. relevance as 0..1 within this result set
  const [rMin, rMax] = [Math.min(...relevance), Math.max(...relevance)];
  const rel = relevance.map((r) => (rMax > rMin ? (r - rMin) / (rMax - rMin) : 0));

  return { method, hd, coords, relevance: rel, keywords: keywordScorer(docs, hd, query) };
}

/**
 * Keywords for a cluster: words frequent in the cluster's papers and rare in the rest
 * (tf in the cluster x idf over all papers), seen in at least two of its papers,
 * leaving out the words of the search itself.
 */
function keywordScorer(docs: string[], hd: HdbscanResult, query: string): (nodeId: number) => string[] {
  const skip = new Set(words(query).map(stem));
  const docWords = docs.map((d) => [...new Set(words(d))]);
  const df = new Map<string, number>();
  for (const ws of docWords) for (const w of ws) df.set(stem(w), (df.get(stem(w)) ?? 0) + 1);
  const n = docs.length;
  const cache = new Map<number, string[]>();
  return (nodeId) => {
    const hit = cache.get(nodeId);
    if (hit) return hit;
    const node = hd.nodes.get(nodeId);
    if (!node) return [];
    const inGroup = new Map<string, { count: number; form: Map<string, number> }>();
    for (const i of node.points) {
      for (const w of docWords[i]) {
        const s = stem(w);
        if (skip.has(s)) continue;
        const e = inGroup.get(s) ?? { count: 0, form: new Map() };
        e.count++;
        e.form.set(w, (e.form.get(w) ?? 0) + 1);
        inGroup.set(s, e);
      }
    }
    const size = node.points.length;
    const rest = Math.max(1, n - size);
    // words common inside the cluster and rare outside it: p_in * log(p_in / p_out)
    const scored = [...inGroup]
      .filter(([, e]) => e.count >= (size >= 4 ? 2 : 1))
      .map(([s, e]) => {
        const form = [...e.form].sort((a, b) => b[1] - a[1])[0][0];
        const pIn = e.count / size;
        const pOut = ((df.get(s) ?? e.count) - e.count) / rest;
        return [form, pIn * Math.log((pIn + 0.02) / (pOut + 0.02))] as const;
      })
      .sort((a, b) => b[1] - a[1]);
    const out = scored.slice(0, 3).map(([w]) => w);
    cache.set(nodeId, out);
    return out;
  };
}
