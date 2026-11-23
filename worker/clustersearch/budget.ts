import { DurableObject } from "cloudflare:workers";

/**
 * One Durable Object ("budget") keeps ClusterSearch inside every provider's limits:
 *  - spacing: arXiv wants 3 s between requests, Semantic Scholar 1 s; take() hands
 *    out the next free time slot per source, across all visitors
 *  - daily caps: our own request counts per source, plus the Workers AI neurons we spend
 *  - exhausted flags: once a provider answers "limit reached", skip it until tomorrow
 * Days are UTC days, matching the Workers AI allowance reset.
 */

export type Take = { ok: true; waitMs: number } | { ok: false };

const AI_DAILY_NEURONS = 9000; // of the free 10,000, leaving room for the site's other uses

const today = () => new Date().toISOString().slice(0, 10);

export class ClusterBudget extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS usage (day TEXT, key TEXT, amount REAL, exhausted INTEGER, PRIMARY KEY (day, key))`);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS slots (key TEXT PRIMARY KEY, next INTEGER)`);
  }

  private row(key: string): { amount: number; exhausted: number } {
    return (
      this.ctx.storage.sql
        .exec<{ amount: number; exhausted: number }>("SELECT amount, exhausted FROM usage WHERE day = ? AND key = ?", today(), key)
        .toArray()[0] ?? { amount: 0, exhausted: 0 }
    );
  }

  private add(key: string, amount: number, exhausted = 0): void {
    this.ctx.storage.sql.exec(
      `INSERT INTO usage (day, key, amount, exhausted) VALUES (?, ?, ?, ?)
       ON CONFLICT(day, key) DO UPDATE SET amount = amount + excluded.amount, exhausted = MAX(exhausted, excluded.exhausted)`,
      today(), key, amount, exhausted,
    );
  }

  /** Reserve one request to a source: counts it and returns how long to wait for its time slot. */
  take(key: string, spacingMs: number, dailyCap: number): Take {
    this.ctx.storage.sql.exec("DELETE FROM usage WHERE day < ?", today()); // only today's counts matter
    const r = this.row(key);
    if (r.exhausted || r.amount >= dailyCap) return { ok: false };
    this.add(key, 1);
    const now = Date.now();
    const next = this.ctx.storage.sql.exec<{ next: number }>("SELECT next FROM slots WHERE key = ?", key).toArray()[0]?.next ?? 0;
    const at = Math.max(now, next);
    this.ctx.storage.sql.exec(
      "INSERT INTO slots (key, next) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET next = excluded.next",
      key, at + spacingMs,
    );
    return { ok: true, waitMs: at - now };
  }

  /** The provider said its limit is reached: skip it for the rest of the day. */
  exhaust(key: string): void {
    this.add(key, 0, 1);
  }

  /** Workers AI: is there room for roughly `neurons` more today? */
  aiAvailable(neurons: number): boolean {
    const r = this.row("ai");
    return !r.exhausted && r.amount + neurons <= AI_DAILY_NEURONS;
  }

  aiSpent(neurons: number): void {
    this.add("ai", neurons);
  }

  /** What the page shows before a search: which sources are out for today. */
  status(keys: string[], caps: Record<string, number>): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const k of keys) {
      const r = this.row(k);
      out[k] = !!r.exhausted || r.amount >= (caps[k] ?? Infinity);
    }
    const ai = this.row("ai");
    out.ai = !!ai.exhausted || ai.amount >= AI_DAILY_NEURONS;
    return out;
  }
}
