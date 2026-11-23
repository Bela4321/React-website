// Secrets are set with `wrangler secret put` and so are not in worker-configuration.d.ts.
interface Env {
  /** https://openalex.org/settings/api */
  OPENALEX_API_KEY?: string;
  /** Semantic Scholar API key (1 request per second) */
  S2_API_KEY?: string;
}
