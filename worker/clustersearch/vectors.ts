// Small helpers shared by the Worker and the page: question detection and a compact
// wire format for embeddings (unit vectors as int8, base64).

const QUESTION_START = /^(how|what|why|which|who|when|where|does|do|did|is|are|can|could|should|would|will|has|have)\b/i;

/** A full question ("How do gut bacteria affect depression?") rather than a keyword query. */
export function looksLikeQuestion(q: string): boolean {
  const t = q.trim();
  return t.endsWith("?") || QUESTION_START.test(t) || t.split(/\s+/).length >= 7;
}

/** Keep the first `dims` components (Matryoshka truncation) and scale to unit length. */
export function prepareVector(v: number[], dims: number): number[] {
  const out = v.slice(0, dims);
  const norm = Math.hypot(...out) || 1;
  return out.map((x) => x / norm);
}

/** Unit vectors -> {dims, data}: each row as int8 (scaled to its largest component), all rows base64-encoded. */
export function packVectors(rows: number[][], dims: number): { dims: number; data: string } {
  const bytes = new Int8Array(rows.length * dims);
  rows.forEach((r, i) => {
    // scale each row so its largest component uses the full int8 range; unpacking re-normalises anyway
    let max = 0;
    for (let j = 0; j < dims; j++) max = Math.max(max, Math.abs(r[j] ?? 0));
    const s = max ? 127 / max : 0;
    for (let j = 0; j < dims; j++) bytes[i * dims + j] = Math.round((r[j] ?? 0) * s);
  });
  let bin = "";
  const u8 = new Uint8Array(bytes.buffer);
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return { dims, data: btoa(bin) };
}

/** The inverse of packVectors, re-normalised to unit length. */
export function unpackVectors(packed: { dims: number; data: string }): Float32Array[] {
  const bin = atob(packed.data);
  const bytes = new Int8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = (bin.charCodeAt(i) << 24) >> 24;
  const rows: Float32Array[] = [];
  for (let i = 0; i < bytes.length; i += packed.dims) {
    const r = Float32Array.from(bytes.subarray(i, i + packed.dims), (x) => x / 127);
    let n = 0;
    for (const x of r) n += x * x;
    n = Math.sqrt(n) || 1;
    for (let j = 0; j < r.length; j++) r[j] /= n;
    rows.push(r);
  }
  return rows;
}
