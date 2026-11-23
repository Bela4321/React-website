import { useState } from "react";
import type { Paper } from "./api.ts";
import type { Analysis } from "./analysis.ts";
import { descendants, maxClusters } from "../lib/cluster/hdbscan.ts";
import { colorOf } from "./ui.ts";

/**
 * The cluster hierarchy. Shown clusters can be split into the two groups HDBSCAN found
 * inside them; a split group can be merged back. A number field cuts the whole tree at
 * a depth that gives that many clusters.
 */
export default function TreeView({
  papers,
  analysis,
  shown,
  onSplit,
  onMerge,
  onCut,
  onReset,
}: {
  papers: Paper[];
  analysis: Analysis;
  shown: number[];
  onSplit: (id: number) => void;
  onMerge: (id: number) => void;
  onCut: (k: number) => void;
  onReset: () => void;
}) {
  const { nodes, root } = analysis.hd;
  const max = maxClusters(nodes);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const shownSet = new Set(shown);
  const hasShownBelow = (id: number) => descendants(nodes, id).some((d) => shownSet.has(d));
  const byRelevance = (ids: number[]) => [...ids].sort((a, b) => analysis.relevance[b] - analysis.relevance[a]);

  const row = (id: number, depth: number): React.ReactNode => {
    const node = nodes.get(id)!;
    const words = id === root ? ["all results"] : analysis.keywords(id);
    if (shownSet.has(id)) {
      const ci = shown.indexOf(id);
      const isOpen = open.has(id);
      return (
        <li key={id} style={{ marginLeft: depth * 20 }} className="rounded-2xl bg-white p-4 ring-1 ring-plum/10">
          <div className="flex flex-wrap items-center gap-3">
            <span className="size-3 shrink-0 rounded-full" style={{ background: colorOf(ci) }} aria-hidden="true" />
            <button
              type="button"
              className="min-w-0 flex-1 text-left font-medium hover:text-plum"
              aria-expanded={isOpen}
              onClick={() => setOpen((s) => new Set(s.has(id) ? [...s].filter((x) => x !== id) : [...s, id]))}
            >
              {words.join(" · ") || "cluster"} <span className="font-normal text-muted">({node.points.length} papers)</span>
            </button>
            {node.children.length > 0 && (
              <button type="button" className="btn-quiet h-8 px-3 text-sm" onClick={() => onSplit(id)}>
                Split
              </button>
            )}
            {node.parent !== null && node.parent !== root && (
              <button type="button" className="h-8 px-2 text-sm text-muted hover:text-ink" onClick={() => onMerge(id)}>
                Merge up
              </button>
            )}
          </div>
          {isOpen && (
            <ul className="mt-3 grid gap-1.5 border-t border-line pt-3 text-sm">
              {byRelevance(node.points)
                .slice(0, 8)
                .map((i) => (
                  <li key={papers[i].id}>
                    <a href={papers[i].url} target="_blank" rel="noopener" className="hover:text-plum hover:underline">
                      {papers[i].title}
                    </a>
                    <span className="text-muted"> {papers[i].year ?? ""}</span>
                  </li>
                ))}
              {node.points.length > 8 && <li className="text-muted">and {node.points.length - 8} more in the list view</li>}
            </ul>
          )}
        </li>
      );
    }
    if (!hasShownBelow(id)) return null;
    return (
      <li key={id} className="grid gap-2">
        {id !== root && (
          <div style={{ marginLeft: depth * 20 }} className="flex items-center gap-2 text-sm text-muted">
            <span aria-hidden="true">▾</span>
            <span>
              {words.join(" · ")} ({node.points.length})
            </span>
            <button type="button" className="font-medium text-plum hover:underline" onClick={() => onMerge(node.children[0])}>
              Merge
            </button>
          </div>
        )}
        <ul className="grid gap-2">{node.children.map((c) => row(c, id === root ? depth : depth + 1))}</ul>
      </li>
    );
  };

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          Show
          <input
            type="number"
            min={1}
            max={max}
            value={shown.length}
            onChange={(e) => onCut(Math.max(1, Math.min(max, Number(e.target.value) || 1)))}
            className="input h-9 w-20 px-3"
          />
          of up to {max} clusters
        </label>
        <button type="button" className="text-plum hover:underline" onClick={onReset}>
          Back to HDBSCAN's choice
        </button>
      </div>
      <ul className="grid gap-2">{row(root, 0)}</ul>
    </div>
  );
}
