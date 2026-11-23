import { useState } from "react";
import type { Paper } from "./api.ts";
import type { Analysis } from "./analysis.ts";
import { maxClusters } from "../lib/cluster/hdbscan.ts";
import { authorsLine, colorOf, NOISE_COLOR, sourceNames } from "./ui.ts";

/** All papers grouped by cluster, best matches first; the slider sets the number of clusters. */
export default function ListView({
  papers,
  analysis,
  shown,
  labels,
  onCut,
}: {
  papers: Paper[];
  analysis: Analysis;
  shown: number[];
  labels: number[];
  onCut: (k: number) => void;
}) {
  const max = maxClusters(analysis.hd.nodes);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const byRelevance = (ids: number[]) => [...ids].sort((a, b) => analysis.relevance[b] - analysis.relevance[a]);
  const groups = [
    ...shown.map((id, ci) => ({ key: String(id), color: colorOf(ci), title: analysis.keywords(id).join(" · ") || "cluster", ids: byRelevance(labels.flatMap((l, i) => (l === id ? [i] : []))) })),
    { key: "noise", color: NOISE_COLOR, title: "Not in any cluster", ids: byRelevance(labels.flatMap((l, i) => (l === -1 ? [i] : []))) },
  ].filter((g) => g.ids.length);

  return (
    <div className="grid gap-6">
      <label className="grid max-w-md gap-2 text-sm">
        <span>
          <span className="font-medium">{shown.length}</span> {shown.length === 1 ? "cluster" : "clusters"}
        </span>
        <input type="range" min={1} max={Math.max(1, max)} value={shown.length} onChange={(e) => onCut(Number(e.target.value))} className="accent-plum" />
      </label>
      {groups.map((g) => (
        <section key={g.key} className="rounded-3xl bg-white p-5 ring-1 ring-plum/10 sm:p-6">
          <h3 className="flex items-center gap-3 text-lg font-medium">
            <span className="size-3 shrink-0 rounded-full" style={{ background: g.color }} aria-hidden="true" />
            {g.title} <span className="text-base font-normal text-muted">({g.ids.length})</span>
          </h3>
          <ul className="mt-4 divide-y divide-line">
            {g.ids.map((i) => {
              const p = papers[i];
              const isOpen = expanded.has(p.id);
              return (
                <li key={p.id} className="py-3">
                  <a href={p.url} target="_blank" rel="noopener" className="font-medium hover:text-plum hover:underline">
                    {p.title}
                  </a>
                  <p className="mt-0.5 text-sm text-muted">
                    {[authorsLine(p.authors, p.authorCount), p.year, p.venue].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                    {p.sources.map((s) => (
                      <span key={s} className="rounded-full bg-lilac px-2 py-0.5 text-muted">
                        {sourceNames[s]}
                      </span>
                    ))}
                    <button
                      type="button"
                      className="ml-1 font-medium text-plum hover:underline"
                      aria-expanded={isOpen}
                      onClick={() => setExpanded((s) => new Set(s.has(p.id) ? [...s].filter((x) => x !== p.id) : [...s, p.id]))}
                    >
                      {isOpen ? "Hide abstract" : "Show abstract"}
                    </button>
                  </p>
                  {isOpen && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{p.abstract}</p>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
