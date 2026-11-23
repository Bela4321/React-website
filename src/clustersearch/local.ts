// "Local processing": bge-small-en-v1.5 (quantised, ~34 MB) running in the browser with
// transformers.js. The ONNX runtime comes from this site (/ort/); the model files come
// from Hugging Face once and then sit in the browser cache.

type Extractor = (texts: string[], opts: Record<string, unknown>) => Promise<{ tolist(): number[][] }>;

let extractor: Promise<Extractor> | null = null;

export const LOCAL_MODEL = "Xenova/bge-small-en-v1.5";
/** bge models want this prefix on queries (not on the documents) */
const QUERY_PREFIX = "Represent this sentence for searching relevant passages: ";

export function loadModel(onProgress: (fraction: number) => void): Promise<Extractor> {
  extractor ??= (async () => {
    const { pipeline, env } = await import("@huggingface/transformers");
    env.allowLocalModels = false;
    const onnx = env.backends.onnx as { wasm?: { wasmPaths?: unknown; numThreads?: number } };
    if (onnx.wasm) {
      onnx.wasm.wasmPaths = { wasm: "/ort/ort-wasm-simd-threaded.wasm", mjs: "/ort/ort-wasm-simd-threaded.mjs" };
      onnx.wasm.numThreads = 1; // threads need cross-origin isolation, which this site doesn't set
    }
    const files = new Map<string, { loaded: number; total: number }>();
    const pipe = await pipeline("feature-extraction", LOCAL_MODEL, {
      dtype: "q8",
      device: "wasm",
      progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
        if (p.status === "progress" && p.file) {
          files.set(p.file, { loaded: p.loaded ?? 0, total: p.total ?? 0 });
          let loaded = 0;
          let total = 0;
          for (const f of files.values()) {
            loaded += f.loaded;
            total += f.total;
          }
          if (total) onProgress(loaded / total);
        }
      },
    });
    onProgress(1);
    return pipe as unknown as Extractor;
  })();
  extractor.catch(() => (extractor = null));
  return extractor;
}

/** Unit vectors for texts, a few at a time so the page stays responsive. */
export async function embedLocally(
  texts: string[],
  asQuery: boolean,
  onProgress: (done: number) => void,
): Promise<Float32Array[]> {
  const run = await loadModel(() => {});
  const out: Float32Array[] = [];
  const batch = 8;
  for (let i = 0; i < texts.length; i += batch) {
    const chunk = texts.slice(i, i + batch).map((t) => (asQuery ? QUERY_PREFIX + t : t));
    const result = await run(chunk, { pooling: "cls", normalize: true });
    for (const v of result.tolist()) out.push(Float32Array.from(v));
    onProgress(Math.min(texts.length, i + batch));
    await new Promise((r) => setTimeout(r)); // let the page paint between batches
  }
  return out;
}
