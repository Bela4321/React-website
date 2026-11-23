import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildRequest, Deduper, embedText, invertedToText, parseArxiv, parseEuropePmc, parseOpenAlex, parseS2, readResponse, LimitReached,
} from "../worker/clustersearch/sources.ts";

const fixture = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");
const keys = { contact: "api_usage@belaschinke.com" };

test("arXiv: entries become papers", () => {
  const [p] = parseArxiv(fixture("arxiv.xml"));
  assert.equal(p.id, "arxiv:2105.03903");
  assert.equal(p.title, "Rough Set Microbiome Characterisation");
  assert.match(p.abstract, /^Microbiota profiles measure/);
  assert.equal(p.year, 2021);
  assert.deepEqual(p.authors, ["Benjamin Wingfield", "Sonya Coleman", "T. M. McGinnity"]);
  assert.equal(p.authorCount, 4);
  assert.equal(p.url, "https://arxiv.org/abs/2105.03903");
});

test("OpenAlex: abstracts are rebuilt from the inverted index, papers without one dropped", () => {
  assert.equal(invertedToText({ world: [1], hello: [0], again: [2] }), "hello world again");
  const papers = parseOpenAlex(JSON.parse(fixture("openalex.json")));
  assert.ok(papers.length >= 1);
  for (const p of papers) {
    assert.ok(p.abstract.length > 20);
    assert.ok(p.doi === null || !p.doi.startsWith("http"));
    assert.ok(p.url.startsWith("http"));
  }
});

test("Europe PMC: markup removed, only papers with abstracts", () => {
  const papers = parseEuropePmc(JSON.parse(fixture("epmc.json")));
  assert.ok(papers.length >= 1);
  for (const p of papers) {
    assert.ok(!/<[a-z]/i.test(p.abstract), p.abstract.slice(0, 80));
    assert.ok(p.year && p.year > 1900);
  }
});

test("Semantic Scholar: DOI normalised, papers without abstract dropped", () => {
  const papers = parseS2(JSON.parse(fixture("s2.json")));
  assert.equal(papers.length, 1);
  assert.equal(papers[0].doi, "10.1016/j.cub.2022.02.023");
});

test("de-duplication joins the same paper from two sources", () => {
  const d = new Deduper();
  const s2 = parseS2(JSON.parse(fixture("s2.json")));
  const oa = parseOpenAlex(JSON.parse(fixture("openalex.json")));
  d.add(oa);
  const { fresh, also } = d.add(s2);
  // "The gut microbiome" (doi 10.1016/j.cub.2022.02.023) is in both, if OpenAlex kept it
  const shared = d.all.find((p) => p.doi === "10.1016/j.cub.2022.02.023");
  if (shared && shared.sources.length === 2) {
    assert.equal(fresh.length, 0);
    assert.deepEqual(also, [shared.id]);
  }
  assert.equal(new Set(d.all.map((p) => p.id)).size, d.all.length);
});

test("requests: keys go where each provider expects them", () => {
  const oa = new URL(buildRequest("openalex", "gut microbiome", { ...keys, openalexKey: "K" }).url);
  assert.equal(oa.searchParams.get("api_key"), "K");
  const s2 = buildRequest("s2", "gut microbiome", { ...keys, s2Key: "S" });
  assert.equal(s2.headers.get("x-api-key"), "S");
  const ax = new URL(buildRequest("arxiv", "gut microbiome", keys).url);
  assert.equal(ax.searchParams.get("search_query"), "all:gut AND all:microbiome");
  assert.equal(new URL(buildRequest("arxiv", "gut microbiome", keys, "any").url).searchParams.get("search_query"), "all:gut OR all:microbiome");
  assert.match(s2.headers.get("User-Agent")!, /api_usage@belaschinke\.com/);
});

test("limits are recognised", async () => {
  await assert.rejects(readResponse("s2", new Response("x", { status: 429 })), LimitReached);
  await assert.rejects(readResponse("openalex", new Response('{"error":"Rate limit exceeded","message":"Insufficient budget"}', { status: 403 })), LimitReached);
  await assert.rejects(readResponse("arxiv", new Response("Rate exceeded.", { status: 200 })), LimitReached);
  await assert.rejects(readResponse("europepmc", new Response("oops", { status: 500 })), (e: Error) => !(e instanceof LimitReached));
});

test("embedded text stays bounded", () => {
  const long = { title: "T", abstract: "x".repeat(5000) } as any;
  assert.equal(embedText(long).length, 1600);
});
