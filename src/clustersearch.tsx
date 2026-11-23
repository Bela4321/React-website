import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { nameClusters, search, todaysLimits, type Paper, type SourceId, type SourceState } from "./clustersearch/api.ts";
import { analyse, type Analysis, type Method } from "./clustersearch/analysis.ts";
import { embedLocally, loadModel } from "./clustersearch/local.ts";
import { cutToK, labelsFor, maxClusters, mergeNode, splitNode } from "./lib/cluster/hdbscan.ts";
import { unpackVectors } from "../worker/clustersearch/vectors.ts";
import { embedText } from "../worker/clustersearch/sources.ts";
import { sourceNames } from "./clustersearch/ui.ts";
import MapView from "./clustersearch/MapView.tsx";
import TreeView from "./clustersearch/TreeView.tsx";
import ListView from "./clustersearch/ListView.tsx";
import "./styles.css";

const SUGGESTIONS = [
  "environmental impact of meat consumption",
  "How do gut bacteria affect depression?",
  "nuclear energy in global geopolitics",
  "how to be happy",
];
const SOURCE_IDS: SourceId[] = ["arxiv", "openalex", "europepmc", "s2"];

type Run = {
  query: string;
  terms: string | null;
  rewritten: boolean;
  mode: "server" | "local";
  sources: Record<SourceId, { state: SourceState; count: number }>;
  papers: Paper[];
  vectors: Map<string, Float32Array>;
  queryVector: Float32Array | null;
  aiProblem: "limit" | "error" | null;
  done: boolean;
  error: string | null;
};
type Local = { phase: "model" | "embed"; fraction: number } | null;

function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

function ClusterSearch() {
  const [input, setInput] = useState(() => new URLSearchParams(location.search).get("q") ?? "");
  const [localMode, setLocalMode] = useState(() => readPref("cs-local") === "1");
  const [info, setInfo] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [local, setLocal] = useState<Local>(null);
  const [method, setMethod] = useState<Method>("embedding");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<number[]>([]);
  const [tab, setTab] = useState<"map" | "tree" | "list">("map");
  // names from the language model, per analysis; ids asked for already
  const [names, setNames] = useState<Map<number, string>>(new Map());
  const asked = useRef<Set<number>>(new Set());
  const abort = useRef<AbortController | null>(null);
  const runRef = useRef<Run | null>(null);

  // if today's server allowance for embeddings is gone, start in local mode
  useEffect(() => {
    todaysLimits()
      .then((l) => {
        if (l.ai) {
          setLocalMode(true);
          setNotice("Today's free server allowance for embeddings is used up, so local processing is switched on.");
        }
      })
      .catch(() => {});
    if (input.trim()) start(input);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (f: (r: Run) => void) => {
    const r = runRef.current;
    if (!r) return;
    f(r);
    setRun({ ...r });
  };

  async function start(q: string) {
    const query = q.trim();
    if (query.length < 2) return;
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    const url = new URL(location.href);
    url.searchParams.set("q", query);
    history.replaceState(null, "", url);

    const mode = localMode ? "local" : "server";
    runRef.current = {
      query,
      terms: null,
      rewritten: false,
      mode,
      sources: Object.fromEntries(SOURCE_IDS.map((id) => [id, { state: "waiting", count: 0 }])) as Run["sources"],
      papers: [],
      vectors: new Map(),
      queryVector: null,
      aiProblem: null,
      done: false,
      error: null,
    };
    setRun({ ...runRef.current });
    setAnalysis(null);
    setLocal(null);
    setMethod("embedding");
    if (mode === "local") loadModel((fraction) => setLocal((l) => (l?.phase === "embed" ? l : { phase: "model", fraction }))).catch(() => {});

    try {
      for await (const e of search(query, mode, ctrl.signal)) {
        if (ctrl.signal.aborted) return;
        update((r) => {
          if (e.t === "start") {
            r.terms = e.terms;
            r.rewritten = e.rewritten;
          } else if (e.t === "source") {
            r.sources[e.id] = { state: e.state, count: e.count ?? r.sources[e.id].count };
          } else if (e.t === "papers") {
            r.papers = [...r.papers, ...e.papers];
            if (e.vectors) unpackVectors(e.vectors).forEach((v, i) => r.vectors.set(e.papers[i].id, v));
          } else if (e.t === "also") {
            r.papers = r.papers.map((p) => (e.ids.includes(p.id) && !p.sources.includes(e.source) ? { ...p, sources: [...p.sources, e.source] } : p));
          } else if (e.t === "query") {
            r.queryVector = unpackVectors(e.vector)[0];
          } else if (e.t === "ai") {
            r.aiProblem = e.state;
          } else if (e.t === "error") {
            r.error = e.message;
          }
        });
      }
    } catch (err) {
      if (!ctrl.signal.aborted) update((r) => (r.error = (err as Error).message));
      return;
    }
    if (ctrl.signal.aborted) return;
    update((r) => (r.done = true));
    const r = runRef.current!;
    if (!r.papers.length) return;
    if (mode === "local") await embedOnDevice(ctrl);
    if (ctrl.signal.aborted) return;
    compute(runRef.current!.vectors.size === runRef.current!.papers.length ? "embedding" : "tfidf");
  }

  /** Embeds the current papers (and the query) in the browser. */
  async function embedOnDevice(ctrl: AbortController) {
    const r = runRef.current!;
    try {
      await loadModel((fraction) => setLocal({ phase: "model", fraction }));
      setLocal({ phase: "embed", fraction: 0 });
      const vs = await embedLocally(r.papers.map((p) => embedText(p)), false, (d) => setLocal({ phase: "embed", fraction: d / r.papers.length }));
      if (ctrl.signal.aborted) return;
      const [qv] = await embedLocally([r.query], true, () => {});
      update((x) => {
        x.vectors = new Map(x.papers.map((p, i) => [p.id, vs[i]]));
        x.queryVector = qv;
        x.aiProblem = null;
        x.mode = "local";
      });
      setLocal(null);
    } catch (err) {
      setLocal(null);
      setNotice(`Local processing failed (${(err as Error).message}). Showing the TF-IDF clustering instead.`);
    }
  }

  function compute(m: Method) {
    const r = runRef.current;
    if (!r || !r.papers.length) return;
    setBusy(true);
    setMethod(m);
    setTimeout(() => {
      const vectors = r.papers.map((p) => r.vectors.get(p.id));
      const a = analyse(r.papers, vectors, r.queryVector, r.terms ?? r.query, m);
      setAnalysis(a);
      setNames(new Map());
      asked.current = new Set();
      setShown(a.hd.selected.length ? a.hd.selected : cutToK(a.hd.nodes, a.hd.root, Math.min(5, maxClusters(a.hd.nodes))));
      setBusy(false);
    }, 30);
  }

  // name the shown clusters and the groups above them, a batch at a time
  useEffect(() => {
    if (!analysis || !run) return;
    const { nodes, root } = analysis.hd;
    // the shown clusters, plus the groups above them where the tree branches into several shown ones
    const want = new Set<number>(shown);
    const shownSet = new Set(shown);
    const holdsShown = (id: number): boolean => shownSet.has(id) || nodes.get(id)!.children.some(holdsShown);
    for (const id of shown) {
      for (let x = nodes.get(id)!.parent; x !== null && x !== root; x = nodes.get(x)!.parent) {
        if (nodes.get(x)!.children.filter(holdsShown).length > 1) want.add(x);
      }
    }
    const missing = [...want].filter((id) => !asked.current.has(id));
    if (!missing.length) return;
    missing.forEach((id) => asked.current.add(id));
    const current = analysis;
    nameClusters(run.terms ?? run.query, missing.map((id) => ({ id: String(id), titles: current.typicalTitles(id) })))
      .then((got) => {
        if (current !== analysisRef.current) return;
        setNames((m) => {
          const next = new Map(m);
          for (const [id, name] of Object.entries(got)) next.set(Number(id), name.charAt(0).toUpperCase() + name.slice(1));
          return next;
        });
      })
      .catch(() => {});
  }, [analysis, shown, run]);
  const analysisRef = useRef<Analysis | null>(null);
  analysisRef.current = analysis;
  const nameOf = (id: number) => names.get(id);

  const labels = useMemo(() => (analysis ? labelsFor(analysis.hd.nodes, shown, run?.papers.length ?? 0) : []), [analysis, shown, run?.papers.length]);
  const canEmbed = !!run && run.papers.length > 0 && run.vectors.size === run.papers.length;
  const searching = !!run && !run.done && !run.error;

  return (
    <div className="grid gap-8">
      {/* search */}
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(input);
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="cs-q">Search papers</label>
          <input
            id="cs-q"
            className="input h-13 w-full text-lg sm:flex-1"
            value={input}
            maxLength={300}
            placeholder="A topic, or a full question"
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="btn-primary h-13 px-7 text-lg" type="submit" disabled={input.trim().length < 2}>
            Search
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Try:</span>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className="rounded-full bg-lilac px-3 py-1.5 text-ink transition hover:bg-lilac-deep"
              onClick={() => {
                setInput(s);
                start(s);
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="relative flex flex-wrap items-center gap-3 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-plum"
              checked={localMode}
              onChange={(e) => {
                setLocalMode(e.target.checked);
                writePref("cs-local", e.target.checked ? "1" : "0");
              }}
            />
            Process on my device
          </label>
          <button
            type="button"
            aria-label="About processing on your device"
            aria-expanded={info}
            className="grid size-6 place-items-center rounded-full bg-lilac text-xs font-semibold text-plum hover:bg-lilac-deep"
            onClick={() => setInfo((x) => !x)}
          >
            i
          </button>
          {info && (
            <p className="w-full max-w-xl rounded-2xl bg-lilac p-4 text-muted">
              Normally a server model (Qwen3 Embedding, on Cloudflare) turns the papers into vectors. With this switched on, a smaller
              model (bge-small, a one-time download of about 34&nbsp;MB from Hugging Face) does it in your browser instead. The search
              itself still runs through the server, but the abstracts are processed on your device. It is slower and a little less
              accurate, and it keeps working when the server's free daily allowance is used up.
            </p>
          )}
        </div>
      </form>

      {notice && <p className="rounded-2xl bg-lilac px-4 py-3 text-sm text-ink">{notice}</p>}

      {/* progress */}
      {run && (
        <section aria-label="Progress" className="grid gap-3">
          {run.terms && run.rewritten && (
            <p className="text-sm text-muted">
              Searched for: <span className="font-medium text-ink">{run.terms}</span>
            </p>
          )}
          <ul className="grid gap-2 sm:grid-cols-2">
            {SOURCE_IDS.map((id) => (
              <SourceBar key={id} name={sourceNames[id]} {...run.sources[id]} local={run.mode === "local"} />
            ))}
          </ul>
          {local && (
            <div className="grid gap-1 text-sm">
              <span className="text-muted">
                {local.phase === "model" ? "Downloading the model to your device" : "Processing abstracts on your device"} ·{" "}
                {Math.round(local.fraction * 100)}%
              </span>
              <div className="h-2 overflow-hidden rounded-full bg-lilac">
                <div className="h-full rounded-full bg-plum transition-[width]" style={{ width: `${local.fraction * 100}%` }} />
              </div>
            </div>
          )}
          {run.aiProblem && run.mode === "server" && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-lilac px-4 py-3 text-sm">
              <span>
                {run.aiProblem === "limit"
                  ? "Today's free server allowance for embeddings is used up."
                  : "The server could not compute the embeddings."}{" "}
                The clusters below use the TF-IDF baseline.
              </span>
              {run.done && (
                <button
                  type="button"
                  className="font-medium text-plum hover:underline"
                  onClick={async () => {
                    setLocalMode(true);
                    writePref("cs-local", "1");
                    const ctrl = new AbortController();
                    abort.current = ctrl;
                    await embedOnDevice(ctrl);
                    compute(runRef.current!.vectors.size === runRef.current!.papers.length ? "embedding" : "tfidf");
                  }}
                >
                  Process on my device instead
                </button>
              )}
            </div>
          )}
          {run.error && <p className="text-sm text-red-700">{run.error}</p>}
          {run.done && !run.error && run.papers.length === 0 && <p className="text-muted">No papers found. Try fewer or broader words.</p>}
        </section>
      )}

      {/* results */}
      {run && (analysis || busy || searching) && run.papers.length > 0 && (
        <section aria-label="Results" className="grid gap-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div role="tablist" aria-label="View" className="inline-grid grid-cols-3 rounded-xl bg-lilac p-1">
              {(
                [
                  ["map", "Map"],
                  ["tree", "Tree"],
                  ["list", "List"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  type="button"
                  aria-selected={tab === id}
                  className={`rounded-lg px-4 py-2 font-medium transition ${tab === id ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">Clustered by</span>
              <div className="inline-grid grid-cols-2 rounded-xl bg-lilac p-1">
                <button
                  type="button"
                  disabled={!canEmbed || busy}
                  aria-pressed={method === "embedding"}
                  className={`rounded-lg px-3 py-1.5 font-medium transition disabled:opacity-40 ${method === "embedding" ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}
                  onClick={() => compute("embedding")}
                >
                  Meaning ({run.mode === "local" ? "bge-small" : "Qwen3"})
                </button>
                <button
                  type="button"
                  disabled={busy || !run.done}
                  aria-pressed={method === "tfidf"}
                  className={`rounded-lg px-3 py-1.5 font-medium transition disabled:opacity-40 ${method === "tfidf" ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}
                  onClick={() => compute("tfidf")}
                >
                  Words (TF-IDF)
                </button>
              </div>
            </div>
          </div>

          {!analysis || busy ? (
            <p className="rounded-3xl bg-lilac px-6 py-16 text-center text-muted">
              {busy ? "Clustering…" : `${run.papers.length} papers so far. The clusters appear when all four sources have answered.`}
            </p>
          ) : (
            <>
              <p className="text-sm text-muted">
                {run.papers.length} papers · {analysis.hd.selected.length} clusters found by HDBSCAN · showing {shown.length}
              </p>
              {tab === "map" && <MapView papers={run.papers} analysis={analysis} shown={shown} labels={labels} nameOf={nameOf} />}
              {tab === "tree" && (
                <TreeView
                  papers={run.papers}
                  analysis={analysis}
                  nameOf={nameOf}
                  shown={shown}
                  onSplit={(id) => setShown(splitNode(analysis.hd.nodes, analysis.hd.root, shown, id))}
                  onMerge={(id) => setShown(mergeNode(analysis.hd.nodes, analysis.hd.root, shown, id))}
                  onCut={(k) => setShown(cutToK(analysis.hd.nodes, analysis.hd.root, k))}
                  onReset={() => setShown(analysis.hd.selected.length ? analysis.hd.selected : cutToK(analysis.hd.nodes, analysis.hd.root, 5))}
                />
              )}
              {tab === "list" && (
                <ListView
                  papers={run.papers}
                  analysis={analysis}
                  nameOf={nameOf}
                  shown={shown}
                  labels={labels}
                  onCut={(k) => setShown(cutToK(analysis.hd.nodes, analysis.hd.root, k))}
                />
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

function SourceBar({ name, state, count, local }: { name: string; state: SourceState; count: number; local: boolean }) {
  const steps: Record<SourceState, { width: number; text: string; tone: string }> = {
    waiting: { width: 4, text: "Waiting", tone: "bg-plum-soft" },
    searching: { width: 35, text: "Searching", tone: "bg-plum-soft" },
    embedding: { width: 70, text: `Embedding ${count} papers`, tone: "bg-plum" },
    done: { width: 100, text: `${count} papers${local ? "" : ", embedded"}`, tone: "bg-plum" },
    limit: { width: 100, text: "Limit reached, try again later", tone: "bg-amber-400" },
    error: { width: 100, text: "Couldn't be reached", tone: "bg-red-400" },
  };
  const s = steps[state];
  return (
    <li className="grid gap-1 rounded-2xl bg-white px-4 py-3 ring-1 ring-plum/10">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{name}</span>
        <span className="text-muted">{s.text}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-lilac" role="progressbar" aria-label={name} aria-valuenow={s.width} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full transition-[width] duration-700 ${s.tone} ${state === "searching" || state === "embedding" ? "animate-pulse" : ""}`} style={{ width: `${s.width}%` }} />
      </div>
    </li>
  );
}

createRoot(document.getElementById("app")!).render(<ClusterSearch />);
