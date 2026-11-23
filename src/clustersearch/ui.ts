import type { SourceId } from "./api.ts";

// cluster colours, in the order the clusters are listed; distinct on white and with the site's purple
const PALETTE = ["#6a3fb5", "#0e9f8e", "#e07a1f", "#2f7fd8", "#d6457a", "#7a9a1a", "#9b59d0", "#c0392b", "#1aa3c6", "#b8860b", "#4a5bd4", "#d17ab3"];
export const colorOf = (i: number) => PALETTE[i % PALETTE.length];
export const NOISE_COLOR = "#b9b3c7";

export const sourceNames: Record<SourceId, string> = {
  arxiv: "arXiv",
  openalex: "OpenAlex",
  europepmc: "Europe PMC",
  s2: "Semantic Scholar",
};

export function authorsLine(authors: string[], count: number): string {
  if (!authors.length) return "";
  return count > authors.length ? `${authors.join(", ")} et al.` : authors.join(", ");
}
