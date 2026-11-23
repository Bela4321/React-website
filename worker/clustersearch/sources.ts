// The four search engines behind ClusterSearch, each turned into one Paper shape.
// Parsing is kept pure (no Workers APIs) so it can be tested against real
// responses saved in tests/fixtures.

export type SourceId = "arxiv" | "openalex" | "europepmc" | "s2";

export interface Paper {
  /** stable id within the result set: "<source>:<native id>" of the first source that found it */
  id: string;
  title: string;
  abstract: string;
  year: number | null;
  /** up to three names, "et al." added by the page */
  authors: string[];
  authorCount: number;
  venue: string | null;
  url: string;
  doi: string | null;
  /** every source that returned this paper (filled during de-duplication) */
  sources: SourceId[];
}

export interface SourceInfo {
  id: SourceId;
  name: string;
  /** minimum gap between two requests to this API, across all visitors */
  spacingMs: number;
  /** our own daily request cap, well below the provider's limit */
  dailyCap: number;
}

export const SOURCES: SourceInfo[] = [
  { id: "arxiv", name: "arXiv", spacingMs: 3000, dailyCap: 1500 },
  { id: "openalex", name: "OpenAlex", spacingMs: 100, dailyCap: 1500 },
  { id: "europepmc", name: "Europe PMC", spacingMs: 100, dailyCap: 1500 },
  { id: "s2", name: "Semantic Scholar", spacingMs: 3000, dailyCap: 1500 }, // key allows 1/s, but refuses often below ~3 s
];

export const PER_SOURCE = 50;

export interface SourceKeys {
  contact: string;
  openalexKey?: string;
  s2Key?: string;
}

/**
 * Thrown when a provider says its limit is reached. `daily` means it is used up until
 * tomorrow (OpenAlex's budget, our own caps); otherwise it is a short rate limit (HTTP 429).
 */
export class LimitReached extends Error {
  readonly daily: boolean;
  constructor(message: string, daily = false) {
    super(message);
    this.daily = daily;
  }
}

// words that carry no meaning for arXiv's word-by-word matching
const STOPWORDS = new Set("a an and are as at be by can do does for from has have how in is it of on or that the this to was what when where which who why with affect affects".split(" "));

// --- requests -----------------------------------------------------------------

export function userAgent(contact: string): string {
  return `ClusterSearch/1.0 (https://belaschinke.com/clustersearch/; mailto:${contact})`;
}

/** The request for one source. `terms` is the keyword query (already rewritten if it was a question). */
export function buildRequest(source: SourceId, terms: string, keys: SourceKeys, mode: "all" | "any" = "all"): Request {
  const headers: Record<string, string> = { "User-Agent": userAgent(keys.contact), Accept: "application/json" };
  const q = terms.trim();
  switch (source) {
    case "arxiv": {
      const words = q
        .split(/\s+/)
        .map((w) => w.replace(/[^\p{L}\p{N}\-]/gu, ""))
        .filter((w) => w && !STOPWORDS.has(w.toLowerCase()))
        .map((w) => `all:${w}`);
      const query = words.join(mode === "all" ? " AND " : " OR ");
      const u = new URL("https://export.arxiv.org/api/query");
      u.searchParams.set("search_query", query);
      u.searchParams.set("max_results", String(PER_SOURCE));
      u.searchParams.set("sortBy", "relevance");
      headers.Accept = "application/atom+xml";
      return new Request(u, { headers });
    }
    case "openalex": {
      const u = new URL("https://api.openalex.org/works");
      u.searchParams.set("search", q);
      u.searchParams.set("per_page", String(PER_SOURCE));
      u.searchParams.set("filter", "has_abstract:true");
      u.searchParams.set("select", "id,doi,title,publication_year,authorships,primary_location,abstract_inverted_index");
      if (keys.openalexKey) u.searchParams.set("api_key", keys.openalexKey);
      else u.searchParams.set("mailto", keys.contact);
      return new Request(u, { headers });
    }
    case "europepmc": {
      const u = new URL("https://www.ebi.ac.uk/europepmc/webservices/rest/search");
      u.searchParams.set("query", `${q} AND HAS_ABSTRACT:y`);
      u.searchParams.set("format", "json");
      u.searchParams.set("resultType", "core");
      u.searchParams.set("pageSize", String(PER_SOURCE));
      return new Request(u, { headers });
    }
    case "s2": {
      const u = new URL("https://api.semanticscholar.org/graph/v1/paper/search");
      u.searchParams.set("query", q);
      u.searchParams.set("limit", String(PER_SOURCE));
      u.searchParams.set("fields", "title,abstract,year,authors,venue,externalIds,url");
      if (keys.s2Key) headers["x-api-key"] = keys.s2Key;
      return new Request(u, { headers });
    }
  }
}

// --- parsing ------------------------------------------------------------------

const clean = (s: string | null | undefined) =>
  (s ?? "")
    .replace(/<[^>]+>/g, " ") // stray markup (Europe PMC abstracts carry <h4>, <i> ...)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

export const normDoi = (d: string | null | undefined) =>
  d ? d.toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, "").trim() || null : null;

function paper(source: SourceId, nativeId: string, p: Omit<Paper, "id" | "sources">): Paper {
  return { id: `${source}:${nativeId}`, sources: [source], ...p };
}

const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? null;

export function parseArxiv(xml: string): Paper[] {
  const out: Paper[] = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1];
    const idUrl = clean(tag(e, "id"));
    const arxivId = idUrl.replace(/^https?:\/\/arxiv\.org\/abs\//, "").replace(/v\d+$/, "");
    const authors = [...e.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/g)].map((a) => clean(a[1]));
    const published = clean(tag(e, "published"));
    out.push(
      paper("arxiv", arxivId, {
        title: clean(tag(e, "title")),
        abstract: clean(tag(e, "summary")),
        year: published ? Number(published.slice(0, 4)) : null,
        authors: authors.slice(0, 3),
        authorCount: authors.length,
        venue: "arXiv",
        url: `https://arxiv.org/abs/${arxivId}`,
        doi: normDoi(clean(tag(e, "arxiv:doi")) || null),
      }),
    );
  }
  return out;
}

/** OpenAlex ships abstracts as {word: [positions]}; put the words back in order. */
export function invertedToText(index: Record<string, number[]> | null | undefined): string {
  if (!index) return "";
  const words: string[] = [];
  for (const [w, positions] of Object.entries(index)) for (const p of positions) words[p] = w;
  return words.filter(Boolean).join(" ");
}

export function parseOpenAlex(json: any): Paper[] {
  return (json?.results ?? [])
    .map((w: any) => {
      const authors = (w.authorships ?? []).map((a: any) => a?.author?.display_name).filter(Boolean);
      const doi = normDoi(w.doi);
      const id = String(w.id ?? "").split("/").pop() ?? "";
      return paper("openalex", id, {
        title: clean(w.title),
        abstract: clean(invertedToText(w.abstract_inverted_index)),
        year: w.publication_year ?? null,
        authors: authors.slice(0, 3),
        authorCount: authors.length,
        venue: w.primary_location?.source?.display_name ?? null,
        url: doi ? `https://doi.org/${doi}` : (w.primary_location?.landing_page_url ?? w.id),
        doi,
      });
    })
    .filter((p: Paper) => p.title && p.abstract);
}

export function parseEuropePmc(json: any): Paper[] {
  return (json?.resultList?.result ?? [])
    .map((r: any) => {
      const names = (r.authorList?.author ?? []).map((a: any) => a.fullName).filter(Boolean);
      const authors = names.length ? names : String(r.authorString ?? "").replace(/\.$/, "").split(/,\s*/).filter(Boolean);
      const doi = normDoi(r.doi);
      return paper("europepmc", `${r.source}-${r.id}`, {
        title: clean(r.title).replace(/\.$/, ""),
        abstract: clean(r.abstractText),
        year: r.pubYear ? Number(r.pubYear) : null,
        authors: authors.slice(0, 3),
        authorCount: authors.length,
        venue: r.journalInfo?.journal?.title ?? r.bookOrReportDetails?.publisher ?? null,
        url: doi ? `https://doi.org/${doi}` : `https://europepmc.org/article/${r.source}/${r.id}`,
        doi,
      });
    })
    .filter((p: Paper) => p.title && p.abstract);
}

export function parseS2(json: any): Paper[] {
  return (json?.data ?? [])
    .map((r: any) => {
      const names = (r.authors ?? []).map((a: any) => a.name).filter(Boolean);
      const doi = normDoi(r.externalIds?.DOI);
      return paper("s2", r.paperId, {
        title: clean(r.title),
        abstract: clean(r.abstract),
        year: r.year ?? null,
        authors: names.slice(0, 3),
        authorCount: names.length,
        venue: r.venue || null,
        url: r.url ?? `https://www.semanticscholar.org/paper/${r.paperId}`,
        doi,
      });
    })
    .filter((p: Paper) => p.title && p.abstract);
}

/** Reads a provider response; throws LimitReached on a rate or budget limit, Error otherwise. */
export async function readResponse(source: SourceId, res: Response): Promise<Paper[]> {
  if (res.status === 429) throw new LimitReached(`${source}: rate limit (${(await res.text()).slice(0, 120)})`);
  const body = await res.text();
  if (!res.ok) {
    if (/budget/i.test(body)) throw new LimitReached(`${source}: daily budget`, true);
    if (/rate limit|too many/i.test(body)) throw new LimitReached(`${source}: ${res.status}`);
    throw new Error(`${source}: HTTP ${res.status}`);
  }
  switch (source) {
    case "arxiv":
      if (/^Rate exceeded/i.test(body)) throw new LimitReached("arxiv: rate exceeded");
      return parseArxiv(body);
    case "openalex":
      return parseOpenAlex(JSON.parse(body));
    case "europepmc":
      return parseEuropePmc(JSON.parse(body));
    case "s2":
      return parseS2(JSON.parse(body));
  }
}

// --- de-duplication -------------------------------------------------------------

const normTitle = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * Keeps one entry per paper across sources (same DOI, or same normalised title).
 * Returns the papers that are new; known ones get the source added to `sources`.
 */
export class Deduper {
  private byKey = new Map<string, Paper>();
  readonly all: Paper[] = [];

  /** Adds one source's papers: `fresh` are new to the set, `also` are ids of known papers this source found too. */
  add(papers: Paper[]): { fresh: Paper[]; also: string[] } {
    const fresh: Paper[] = [];
    const also: string[] = [];
    for (const p of papers) {
      const keys = [p.doi ? `doi:${p.doi}` : null, `t:${normTitle(p.title)}`].filter(Boolean) as string[];
      const known = keys.map((k) => this.byKey.get(k)).find(Boolean);
      if (known) {
        let added = false;
        for (const s of p.sources) if (!known.sources.includes(s)) (known.sources.push(s), (added = true));
        if (!known.doi && p.doi) known.doi = p.doi;
        if (added && !fresh.includes(known)) also.push(known.id);
        continue;
      }
      for (const k of keys) this.byKey.set(k, p);
      this.all.push(p);
      fresh.push(p);
    }
    return { fresh, also };
  }
}

/** The text that gets embedded for a paper: title and abstract, cut to keep the token count bounded. */
export function embedText(p: Paper, maxChars = 1600): string {
  const t = `${p.title}. ${p.abstract}`;
  return t.length > maxChars ? t.slice(0, maxChars) : t;
}
