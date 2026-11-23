import {
  buildRequest, Deduper, embedText, LimitReached, PER_SOURCE, readResponse, SOURCES,
  type Paper, type SourceId, type SourceKeys,
} from "./sources";
import { looksLikeQuestion, packVectors, prepareVector } from "./vectors";

/**
 * GET /api/clustersearch?q=<text>&mode=server|local
 *
 * Streams newline-delimited JSON so the page can draw a progress bar per source:
 *   {t:"start", query, terms, rewritten, mode, sources:[{id,name}]}
 *   {t:"source", id, state:"searching"|"embedding"|"done"|"limit"|"error", count?, message?}
 *   {t:"papers", source, papers:[...], vectors?:{dims, data:base64 int8}}  (only papers new to the result set)
 *   {t:"also", source, ids:[...]}                                         (known papers this source found too)
 *   {t:"query", vector:{dims, data}}                                       (the question itself, for ranking)
 *   {t:"ai", state:"limit"|"error"}                                        (server embeddings unavailable)
 *   {t:"end", total}
 * GET /api/clustersearch/status  ->  {arxiv:bool, ..., ai:bool}  (true = used up today)
 *
 * The server only searches and embeds; clustering, the map and the tree run in the browser.
 */

const EMBED_MODEL = "@cf/qwen/qwen3-embedding-0.6b";
const REWRITE_MODEL = "@cf/google/gemma-4-26b-a4b-it";
const DIMS = 512; // Qwen3 embeddings are Matryoshka-trained: the first 512 of 1024 dims keep most of the quality
const NEURONS_PER_TOKEN = 1075 / 1e6;
const CACHE_SECONDS = 24 * 3600;
const QUERY_INSTRUCTION = "Given a research question, retrieve scientific paper abstracts that answer it";

type Send = (event: Record<string, unknown>) => Promise<void>;

export async function handleClusterSearch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const budget = env.CLUSTER_BUDGET.get(env.CLUSTER_BUDGET.idFromName("budget-v2"));

  if (url.pathname === "/api/clustersearch/status") {
    const caps = Object.fromEntries(SOURCES.map((s) => [s.id, s.dailyCap]));
    return json(await budget.status(SOURCES.map((s) => s.id), caps));
  }

  const query = (url.searchParams.get("q") ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  const mode = url.searchParams.get("mode") === "local" ? "local" : "server";
  if (query.length < 2) return json({ error: "Type a search query." }, 400);

  // a few searches a minute per visitor; the daily budgets protect the rest
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  if (!(await env.CLUSTER_RATE.limit({ key: ip })).success) {
    return json({ error: "That was a lot of searches in a short time. Try again in a minute." }, 429);
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  let chain = Promise.resolve();
  // events from parallel sources are written one at a time, in order
  // (a visitor who leaves mid-search closes the stream; later writes are simply dropped)
  const send: Send = (event) =>
    (chain = chain.then(() => writer.write(enc.encode(JSON.stringify(event) + "\n"))).catch(() => {}));

  ctx.waitUntil(
    run(query, mode, env, ctx, budget, send)
      .catch((e) => send({ t: "error", message: String(e?.message ?? e) }))
      .finally(() => chain.then(() => writer.close()).catch(() => {})),
  );

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function run(
  query: string,
  mode: "server" | "local",
  env: Env,
  ctx: ExecutionContext,
  budget: DurableObjectStub<import("./budget").ClusterBudget>,
  send: Send,
): Promise<void> {
  const keys: SourceKeys = { contact: env.CONTACT_EMAIL, openalexKey: cleanKey(env.OPENALEX_API_KEY), s2Key: cleanKey(env.S2_API_KEY) };

  // 1. a full question becomes a keyword query; keywords are used as they are
  let terms = query;
  let rewritten = false;
  if (looksLikeQuestion(query)) {
    const kw = await rewrite(query, env, budget).catch((e) => (console.error("rewrite failed", String(e?.message ?? e)), null));
    if (kw) {
      terms = kw;
      rewritten = true;
    }
  }
  await send({ t: "start", query, terms, rewritten, mode, sources: SOURCES.map(({ id, name }) => ({ id, name })) });

  // 2. the question itself, embedded once, lets the page rank papers by how well they answer it
  let aiOk = mode === "server";
  if (aiOk) {
    const q = await embed([query], env, budget, true).catch((e) => e);
    if (q instanceof Error) {
      aiOk = false;
      await send({ t: "ai", state: q instanceof LimitReached ? "limit" : "error" });
    } else {
      await send({ t: "query", vector: packVectors(q, DIMS) });
    }
  }

  // 3. all four sources in parallel; each streams its own progress
  const dedupe = new Deduper();
  await Promise.all(
    SOURCES.map(async (s) => {
      await send({ t: "source", id: s.id, state: "searching" });
      let papers: Paper[];
      try {
        papers = await search(s.id, terms, keys, env, ctx, budget);
      } catch (e) {
        console.error("source failed", s.id, String((e as Error)?.message));
        const limit = e instanceof LimitReached;
        if (limit && e.daily) await budget.exhaust(s.id);
        await send({ t: "source", id: s.id, state: limit ? "limit" : "error", message: limit ? undefined : String((e as Error).message) });
        return;
      }
      const { fresh, also } = dedupe.add(papers);
      if (also.length) await send({ t: "also", source: s.id, ids: also });

      let vectors: number[][] | null = null;
      if (aiOk && fresh.length) {
        await send({ t: "source", id: s.id, state: "embedding", count: fresh.length });
        const v = await embedCached(s.id, terms, fresh, env, ctx, budget).catch((e) => e);
        if (v instanceof Error) {
          console.error("embedding failed", s.id, String(v.message));
          aiOk = false;
          await send({ t: "ai", state: v instanceof LimitReached ? "limit" : "error" });
        } else vectors = v;
      }
      await send({ t: "papers", source: s.id, papers: fresh, vectors: vectors ? packVectors(vectors, DIMS) : undefined });
      await send({ t: "source", id: s.id, state: "done", count: papers.length });
    }),
  );

  await send({ t: "end", total: dedupe.all.length });
}

// --- searching ------------------------------------------------------------------

const cacheKey = (kind: string, source: string, terms: string) =>
  new Request(`https://clustersearch.cache/${kind}/${source}?q=${encodeURIComponent(terms.toLowerCase())}`);

async function search(
  source: SourceId,
  terms: string,
  keys: SourceKeys,
  env: Env,
  ctx: ExecutionContext,
  budget: DurableObjectStub<import("./budget").ClusterBudget>,
): Promise<Paper[]> {
  const cache = caches.default;
  const key = cacheKey("papers", source, terms);
  const hit = await cache.match(key);
  if (hit) return hit.json();

  const info = SOURCES.find((s) => s.id === source)!;
  const once = async (mode: "all" | "any") => {
    const slot = await budget.take(source, info.spacingMs, info.dailyCap);
    if (!slot.ok) throw new LimitReached(`${source}: daily cap`, true);
    if (slot.waitMs > 0) await sleep(slot.waitMs);
    const res = await fetch(buildRequest(source, terms, keys, mode), { signal: AbortSignal.timeout(15000) });
    return readResponse(source, res);
  };
  // providers refuse a request now and then even inside their limits: two retries, longer pauses
  const ask = async (mode: "all" | "any") => {
    for (const pause of [1500, 3500]) {
      try {
        return await once(mode);
      } catch (e) {
        if (e instanceof LimitReached && e.daily) throw e;
        console.warn("retrying", source, String((e as Error)?.message ?? e).slice(0, 120));
        await sleep(pause);
      }
    }
    return once(mode);
  };

  let papers = await ask("all");
  // arXiv matches every word; for a long keyword list that can leave too little, so widen once
  if (source === "arxiv" && papers.length < 15 && terms.split(/\s+/).length > 1) {
    const wider = await ask("any").catch(() => []);
    const seen = new Set(papers.map((p) => p.id));
    papers = [...papers, ...wider.filter((p) => !seen.has(p.id))].slice(0, PER_SOURCE);
  }
  ctx.waitUntil(cache.put(key, json(papers, 200, CACHE_SECONDS)));
  return papers;
}

// --- embeddings -----------------------------------------------------------------

/** Embeddings for one source's new papers, cached by source + query + paper ids. */
async function embedCached(
  source: SourceId,
  terms: string,
  papers: Paper[],
  env: Env,
  ctx: ExecutionContext,
  budget: DurableObjectStub<import("./budget").ClusterBudget>,
): Promise<number[][]> {
  const cache = caches.default;
  const key = cacheKey("emb", source, `${terms}|${papers.map((p) => p.id).join(",")}`);
  const hit = await cache.match(key);
  if (hit) return hit.json();
  const texts = papers.map((p) => embedText(p));
  const vectors = await embed(texts, env, budget, false).catch(async (e) => {
    if (e instanceof LimitReached) throw e;
    console.warn("retrying embedding", source, String(e?.message ?? e).slice(0, 160));
    await sleep(1000);
    return embed(texts, env, budget, false);
  });
  ctx.waitUntil(cache.put(key, json(vectors, 200, CACHE_SECONDS)));
  return vectors;
}

async function embed(
  texts: string[],
  env: Env,
  budget: DurableObjectStub<import("./budget").ClusterBudget>,
  asQuery: boolean,
): Promise<number[][]> {
  const neurons = (texts.reduce((n, t) => n + t.length, 0) / 4) * NEURONS_PER_TOKEN;
  if (!(await budget.aiAvailable(neurons))) throw new LimitReached("ai: daily budget", true);
  let out: { data?: number[][] };
  try {
    out = (await env.AI.run(
      EMBED_MODEL,
      asQuery ? { queries: texts, instruction: QUERY_INSTRUCTION } : { documents: texts },
    )) as { data?: number[][] };
  } catch (e) {
    // 3036: the account's free daily allocation is used up
    if (/3036|daily free allocation|neurons/i.test(String((e as Error)?.message))) {
      await budget.exhaust("ai");
      throw new LimitReached("ai: free allocation used up", true);
    }
    throw e;
  }
  await budget.aiSpent(neurons);
  if (!out.data || out.data.length !== texts.length) throw new Error("ai: unexpected embedding response");
  return out.data.map((v) => prepareVector(v, DIMS));
}

// --- questions --------------------------------------------------------------------

async function rewrite(
  question: string,
  env: Env,
  budget: DurableObjectStub<import("./budget").ClusterBudget>,
): Promise<string | null> {
  if (!(await budget.aiAvailable(5))) return null;
  const out = (await env.AI.run(REWRITE_MODEL, {
    messages: [
      {
        role: "system",
        content:
          "Turn the user's research question into a keyword query for academic search engines (arXiv, PubMed, OpenAlex). " +
          "Reply with 2 to 5 English keywords or short phrases separated by spaces, most important first, nothing else. " +
          "No quotes, no punctuation, no explanation.",
      },
      { role: "user", content: question },
    ],
    max_tokens: 40,
    temperature: 0,
    // Gemma 4 reasons before answering by default; for a keyword list that only burns tokens
    chat_template_kwargs: { enable_thinking: false },
  })) as { response?: string; choices?: { message?: { content?: string } }[] };
  await budget.aiSpent(5);
  const text = (out.response ?? out.choices?.[0]?.message?.content ?? "").replace(/["'`.,;:!?\n]/g, " ").replace(/\s+/g, " ").trim();
  const words = text.split(" ").filter(Boolean);
  return words.length >= 1 && words.length <= 10 ? words.join(" ") : null;
}

// --- helpers --------------------------------------------------------------------

/** Keys pasted into `wrangler secret put` sometimes carry quotes or a newline. */
const cleanKey = (k?: string) => k?.trim().replace(/^["']|["']$/g, "") || undefined;

function json(data: unknown, status = 200, maxAge = 0): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": maxAge ? `public, max-age=${maxAge}` : "no-store" },
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
