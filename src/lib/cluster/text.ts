// Text side of ClusterSearch: the TF-IDF baseline (as in the thesis: lowercase, letters
// only, stopwords out, words stemmed, sklearn-style smooth idf, l2-normalised rows) and
// the keyword labels for clusters (class-based TF-IDF on unstemmed words).

import type { SparseRow } from "./pca.ts";

const STOP = new Set(
  (
    "a about above after again against all also am an and any are as at be because been before being below between both but by can " +
    "could did do does doing down during each either et al few for from further had has have having he her here hers herself him " +
    "himself his how however i if in into is it its itself just may me might more most must my myself no nor not now of off on once " +
    "only or other our ours ourselves out over own per same she should so some such than that the their theirs them themselves then " +
    "there these they this those through thus to too under until up upon us use used using very via was we were what when where " +
    "which while who whom why will with within without would yet you your yours yourself yourselves " +
    // words every abstract uses
    "study studies result results show shows shown paper propose proposed approach method methods based present presents " +
    "also new novel one two three first second well however several many much including can could may might different various " +
    "data analysis model models significant significantly found finding findings work research article review introduce introduced " +
    // academic glue words that name no topic
    "impact impacts influence influences effect effects role roles underscore underscores underscoring highlight highlights highlighting " +
    "collectively overall moreover furthermore additionally notably particularly specifically potential potentially associated association " +
    "evidence recent recently current currently understanding insight insights suggest suggests suggesting suggested indicate indicates " +
    "demonstrate demonstrates demonstrated reveal reveals revealed observed observe investigate investigated investigation explore explored " +
    "aim aims objective objectives conclusion conclusions conclude background methods approach approaches framework key important " +
    "increase increased decrease decreased higher lower level levels high low compared comparison respectively total among across " +
    "provide provides provided show showed including include includes related relationship relationships factors factor process processes " +
    "development developed developing role need needs future further therefore thereby addition contribute contributes contributing linearly"
  ).split(/\s+/),
);

export function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/** A light English stemmer (Porter's step 1 and the common derivational endings); enough to join plurals and verb forms. */
export function stem(w: string): string {
  let s = w;
  if (s.endsWith("sses")) s = s.slice(0, -2);
  else if (s.endsWith("ies")) s = s.slice(0, -3) + "i";
  else if (s.endsWith("ss")) s = s;
  else if (s.endsWith("s") && s.length > 3) s = s.slice(0, -1);
  for (const suf of ["ational", "ization", "fulness", "iveness", "ations", "ation", "ingly", "edly", "ing", "ed", "ly", "ment", "ness", "ity", "ive", "ize", "ise", "al"]) {
    if (s.endsWith(suf) && s.length - suf.length >= 3) {
      s = s.slice(0, -suf.length);
      break;
    }
  }
  return s.replace(/(.)\1$/, "$1");
}

/** TF-IDF rows for documents, unit length. */
export function tfidf(docs: string[]): { rows: SparseRow[]; vocab: string[] } {
  const index = new Map<string, number>();
  const counts = docs.map((d) => {
    const c = new Map<number, number>();
    for (const w of words(d)) {
      const s = stem(w);
      let j = index.get(s);
      if (j === undefined) index.set(s, (j = index.size));
      c.set(j, (c.get(j) ?? 0) + 1);
    }
    return c;
  });
  const df = new Float64Array(index.size);
  for (const c of counts) for (const j of c.keys()) df[j]++;
  const n = docs.length;
  const idf = Array.from(df, (x) => Math.log((1 + n) / (1 + x)) + 1);
  const rows = counts.map((c) => {
    const r: SparseRow = new Map();
    let norm = 0;
    for (const [j, tf] of c) {
      const v = tf * idf[j];
      r.set(j, v);
      norm += v * v;
    }
    norm = Math.sqrt(norm) || 1;
    for (const [j, v] of r) r.set(j, v / norm);
    return r;
  });
  const vocab: string[] = [];
  for (const [s, j] of index) vocab[j] = s;
  return { rows, vocab };
}

/**
 * Keywords for each group of documents: class-based TF-IDF (word frequency in the group,
 * weighted by how rare the word is across groups). Words from the search query are left out,
 * since every cluster shares them.
 */
export function clusterKeywords(docs: string[], groups: number[][], exclude: string[] = [], top = 3): string[][] {
  const skip = new Set(exclude.flatMap((q) => words(q)).flatMap((w) => [w, stem(w)]));
  const groupCounts = groups.map((g) => {
    const c = new Map<string, number>();
    for (const i of g) for (const w of words(docs[i])) if (!skip.has(w) && !skip.has(stem(w))) c.set(w, (c.get(w) ?? 0) + 1);
    return c;
  });
  const total = new Map<string, number>();
  for (const c of groupCounts) for (const [w, x] of c) total.set(w, (total.get(w) ?? 0) + x);
  const avg = [...total.values()].reduce((a, b) => a + b, 0) / Math.max(1, groups.length);
  return groupCounts.map((c) => {
    const size = [...c.values()].reduce((a, b) => a + b, 0) || 1;
    const scored = [...c].map(([w, x]) => [w, (x / size) * Math.log(1 + avg / (total.get(w) ?? 1))] as const);
    scored.sort((a, b) => b[1] - a[1]);
    // keep one form per stem ("network", "networks")
    const seen = new Set<string>();
    const out: string[] = [];
    for (const [w] of scored) {
      const s = stem(w);
      if (seen.has(s)) continue;
      seen.add(s);
      out.push(w);
      if (out.length === top) break;
    }
    return out;
  });
}
