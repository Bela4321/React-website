// PCA for a few hundred points, done on the n x n Gram matrix so the dimension of
// the input (512 for embeddings, thousands for TF-IDF) hardly matters.
// Mirrors the thesis' optimal_pca(): keep the fewest components that explain at
// least `varianceThreshold` of the variance (0.4 there, before HDBSCAN).

export type Vector = ArrayLike<number>;
/** a sparse row: term index -> weight */
export type SparseRow = Map<number, number>;

/** Symmetric eigendecomposition (cyclic Jacobi). Returns eigenvalues descending with their eigenvectors as rows. */
export function symmetricEigen(a: Float64Array[], maxSweeps = 60): { values: number[]; vectors: Float64Array[] } {
  const n = a.length;
  const m = a.map((r) => Float64Array.from(r));
  const v = Array.from({ length: n }, (_, i) => {
    const r = new Float64Array(n);
    r[i] = 1;
    return r;
  });
  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += m[p][q] * m[p][q];
    if (off < 1e-20) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = m[p][q];
        if (Math.abs(apq) < 1e-15) continue;
        const theta = (m[q][q] - m[p][p]) / (2 * apq);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const mkp = m[k][p];
          const mkq = m[k][q];
          m[k][p] = c * mkp - s * mkq;
          m[k][q] = s * mkp + c * mkq;
        }
        for (let k = 0; k < n; k++) {
          const mpk = m[p][k];
          const mqk = m[q][k];
          m[p][k] = c * mpk - s * mqk;
          m[q][k] = s * mpk + c * mqk;
        }
        for (let k = 0; k < n; k++) {
          const vpk = v[p][k];
          const vqk = v[q][k];
          v[p][k] = c * vpk - s * vqk;
          v[q][k] = s * vpk + c * vqk;
        }
      }
    }
  }
  const order = [...Array(n).keys()].sort((i, j) => m[j][j] - m[i][i]);
  return { values: order.map((i) => m[i][i]), vectors: order.map((i) => v[i]) };
}

/** Centred Gram matrix of dense rows: G = Xc Xc^T. */
export function gramDense(rows: Vector[]): Float64Array[] {
  const n = rows.length;
  const d = rows[0]?.length ?? 0;
  const mean = new Float64Array(d);
  for (const r of rows) for (let j = 0; j < d; j++) mean[j] += r[j] / n;
  const c = rows.map((r) => Float64Array.from({ length: d }, (_, j) => r[j] - mean[j]));
  const g = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    for (let k = i; k < n; k++) {
      let s = 0;
      for (let j = 0; j < d; j++) s += c[i][j] * c[k][j];
      g[i][k] = g[k][i] = s;
    }
  }
  return g;
}

/** Centred Gram matrix of sparse rows (TF-IDF), without building the dense matrix. */
export function gramSparse(rows: SparseRow[]): Float64Array[] {
  const n = rows.length;
  const mean = new Map<number, number>();
  for (const r of rows) for (const [j, x] of r) mean.set(j, (mean.get(j) ?? 0) + x / n);
  let meanSq = 0;
  for (const x of mean.values()) meanSq += x * x;
  const dotMean = rows.map((r) => {
    let s = 0;
    for (const [j, x] of r) s += x * (mean.get(j) ?? 0);
    return s;
  });
  const g = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    for (let k = i; k < n; k++) {
      let s = 0;
      const [a, b] = rows[i].size < rows[k].size ? [rows[i], rows[k]] : [rows[k], rows[i]];
      for (const [j, x] of a) {
        const y = b.get(j);
        if (y !== undefined) s += x * y;
      }
      // (xi - m)·(xk - m) = xi·xk - xi·m - xk·m + m·m
      g[i][k] = g[k][i] = s - dotMean[i] - dotMean[k] + meanSq;
    }
  }
  return g;
}

/**
 * Principal component scores from a centred Gram matrix, keeping the fewest components
 * whose explained variance reaches `varianceThreshold` (at least `minComponents`).
 */
export function pcaFromGram(g: Float64Array[], varianceThreshold = 0.4, minComponents = 2): number[][] {
  const n = g.length;
  if (n === 0) return [];
  const { values, vectors } = symmetricEigen(g);
  const pos = values.map((x) => Math.max(0, x));
  const total = pos.reduce((a, b) => a + b, 0) || 1;
  let k = 0;
  let acc = 0;
  while (k < pos.length && (acc / total < varianceThreshold || k < minComponents)) acc += pos[k++];
  k = Math.max(1, Math.min(k, n - 1 || 1));
  // scores: U * sqrt(lambda)
  return Array.from({ length: n }, (_, i) => Array.from({ length: k }, (_, c) => vectors[c][i] * Math.sqrt(pos[c])));
}
