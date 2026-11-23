// Reads the /api/clustersearch stream (newline-delimited JSON, see worker/clustersearch/handler.ts).

import type { Paper, SourceId } from "../../worker/clustersearch/sources.ts";

export type { Paper, SourceId };
export type SourceState = "waiting" | "searching" | "embedding" | "done" | "limit" | "error";
export type Packed = { dims: number; data: string };

export type StreamEvent =
  | { t: "start"; query: string; terms: string; rewritten: boolean; mode: "server" | "local"; sources: { id: SourceId; name: string }[] }
  | { t: "source"; id: SourceId; state: SourceState; count?: number; message?: string }
  | { t: "papers"; source: SourceId; papers: Paper[]; vectors?: Packed }
  | { t: "also"; source: SourceId; ids: string[] }
  | { t: "query"; vector: Packed }
  | { t: "ai"; state: "limit" | "error" }
  | { t: "end"; total: number }
  | { t: "error"; message: string };

export async function* search(query: string, mode: "server" | "local", signal: AbortSignal): AsyncGenerator<StreamEvent> {
  const res = await fetch(`/api/clustersearch?q=${encodeURIComponent(query)}&mode=${mode}`, { signal });
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `The search failed (HTTP ${res.status}).`);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) yield JSON.parse(line) as StreamEvent;
    }
  }
}

/** Short names for clusters from the language model; an empty result means "use the keywords". */
export async function nameClusters(query: string, clusters: { id: string; titles: string[] }[]): Promise<Record<string, string>> {
  const res = await fetch("/api/clustersearch/names", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, clusters }),
  });
  if (!res.ok) return {};
  return ((await res.json()) as { names?: Record<string, string> }).names ?? {};
}

export async function todaysLimits(): Promise<Record<string, boolean>> {
  const res = await fetch("/api/clustersearch/status");
  return res.ok ? res.json() : {};
}
