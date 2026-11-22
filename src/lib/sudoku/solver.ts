/**
 * Sudoku solver using Knuth's Algorithm X on the exact-cover formulation
 * (https://en.wikipedia.org/wiki/Exact_cover#Sudoku).
 *
 * Port of the original Java solver (github.com/Bela4321/Sudoku). Same idea and
 * row encoding; branch order is randomised, so puzzles with several solutions
 * yield a random one. Differences from the Java version:
 *  - branches on the constraint column with the fewest candidates (Knuth's
 *    heuristic) instead of over every row, so the search is far smaller;
 *  - covers/uncovers in place instead of copying the matrix each step.
 *
 * Grid convention: 9x9 array of numbers, 0 = empty, 1..9 = digit.
 */

export type Grid = number[][];
export type Cell = { row: number; col: number };
export type Rng = () => number;

export type SolveResult =
  | { status: "solved"; grid: Grid }
  | { status: "invalid"; conflicts: Cell[] }
  | { status: "unsolvable" };

const N = 9;
const ROWS = N * N * N; // 729 candidates: (row, col, value)
const COLS = 4 * N * N; // 324 constraints

// --- static constraint matrix (sparse) -------------------------------------

/** candidate index -> its 4 constraint columns */
const rowCols: Int16Array[] = [];
/** constraint column -> candidate indices that satisfy it */
const colRows: number[][] = Array.from({ length: COLS }, () => []);

for (let r = 0; r < N; r++) {
  for (let c = 0; c < N; c++) {
    for (let v = 0; v < N; v++) {
      const idx = candidateIndex(r, c, v);
      const box = Math.floor(r / 3) * 3 + Math.floor(c / 3);
      const cols = Int16Array.of(
        N * r + c, //                    each cell holds one value
        N * N + N * r + v, //            each value once per row
        2 * N * N + N * c + v, //        each value once per column
        3 * N * N + N * box + v, //      each value once per box
      );
      rowCols[idx] = cols;
      for (const col of cols) colRows[col].push(idx);
    }
  }
}

function candidateIndex(row: number, col: number, value0: number): number {
  return N * N * row + N * col + value0;
}

// --- input validation --------------------------------------------------------

export function assertGridShape(grid: Grid): void {
  if (!Array.isArray(grid) || grid.length !== N) {
    throw new TypeError("grid must have 9 rows");
  }
  for (const row of grid) {
    if (!Array.isArray(row) || row.length !== N) {
      throw new TypeError("each grid row must have 9 cells");
    }
    for (const cell of row) {
      if (!Number.isInteger(cell) || cell < 0 || cell > 9) {
        throw new TypeError("cells must be integers 0..9 (0 = empty)");
      }
    }
  }
}

/** Every given that shares a row, column or box with an equal given. */
export function findConflicts(grid: Grid): Cell[] {
  assertGridShape(grid);
  const bad = new Set<number>();
  for (let r1 = 0; r1 < N; r1++) {
    for (let c1 = 0; c1 < N; c1++) {
      const v = grid[r1][c1];
      if (v === 0) continue;
      for (let r2 = 0; r2 < N; r2++) {
        for (let c2 = 0; c2 < N; c2++) {
          if ((r1 === r2 && c1 === c2) || grid[r2][c2] !== v) continue;
          const sameBox =
            Math.floor(r1 / 3) === Math.floor(r2 / 3) &&
            Math.floor(c1 / 3) === Math.floor(c2 / 3);
          if (r1 === r2 || c1 === c2 || sameBox) bad.add(r1 * N + c1);
        }
      }
    }
  }
  return [...bad].sort((a, b) => a - b).map((i) => ({ row: Math.floor(i / N), col: i % N }));
}

// --- Algorithm X -------------------------------------------------------------

class ExactCover {
  private colActive = new Uint8Array(COLS).fill(1);
  private colSize = new Int16Array(COLS).fill(N);
  /** how many selected candidates currently exclude this candidate */
  private rowRemoved = new Uint8Array(ROWS);
  private activeCols = COLS;
  readonly chosen: number[] = [];

  private rng: Rng;

  constructor(rng: Rng) {
    this.rng = rng;
  }

  isAvailable(idx: number): boolean {
    return this.rowRemoved[idx] === 0;
  }

  select(idx: number): void {
    this.chosen.push(idx);
    for (const col of rowCols[idx]) {
      this.colActive[col] = 0;
      this.activeCols--;
      for (const other of colRows[col]) {
        if (this.rowRemoved[other]++ === 0) {
          for (const c2 of rowCols[other]) this.colSize[c2]--;
        }
      }
    }
  }

  unselect(idx: number): void {
    this.chosen.pop();
    const cols = rowCols[idx];
    for (let i = cols.length - 1; i >= 0; i--) {
      const col = cols[i];
      const rows = colRows[col];
      for (let j = rows.length - 1; j >= 0; j--) {
        const other = rows[j];
        if (--this.rowRemoved[other] === 0) {
          for (const c2 of rowCols[other]) this.colSize[c2]++;
        }
      }
      this.colActive[col] = 1;
      this.activeCols++;
    }
  }

  /** Calls onSolution for each solution; stop early by returning true. */
  search(onSolution: () => boolean): boolean {
    if (this.activeCols === 0) return onSolution();

    // pick the active constraint with the fewest candidates (random tie-break)
    let best = -1;
    let bestSize = Infinity;
    let ties = 0;
    for (let col = 0; col < COLS; col++) {
      if (!this.colActive[col]) continue;
      const size = this.colSize[col];
      if (size < bestSize) {
        best = col;
        bestSize = size;
        ties = 1;
        if (size === 0) return false; // dead end
      } else if (size === bestSize && this.rng() * ++ties < 1) {
        best = col;
      }
    }

    const options = colRows[best].filter((idx) => this.rowRemoved[idx] === 0);
    shuffle(options, this.rng);
    for (const idx of options) {
      this.select(idx);
      const stop = this.search(onSolution);
      this.unselect(idx);
      if (stop) return true;
    }
    return false;
  }
}

function shuffle<T>(arr: T[], rng: Rng): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function setup(grid: Grid, rng: Rng): ExactCover | null {
  const x = new ExactCover(rng);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const v = grid[r][c];
      if (v === 0) continue;
      const idx = candidateIndex(r, c, v - 1);
      if (!x.isAvailable(idx)) return null; // contradicts another given
      x.select(idx);
    }
  }
  return x;
}

function toGrid(chosen: number[]): Grid {
  const grid: Grid = Array.from({ length: N }, () => Array(N).fill(0));
  for (const idx of chosen) {
    const row = Math.floor(idx / (N * N));
    const col = Math.floor((idx % (N * N)) / N);
    grid[row][col] = (idx % N) + 1;
  }
  return grid;
}

export function solve(grid: Grid, rng: Rng = Math.random): SolveResult {
  const conflicts = findConflicts(grid);
  if (conflicts.length > 0) return { status: "invalid", conflicts };

  const x = setup(grid, rng);
  if (!x) return { status: "unsolvable" };
  let result: Grid | null = null;
  x.search(() => {
    result = toGrid(x.chosen);
    return true;
  });
  return result ? { status: "solved", grid: result } : { status: "unsolvable" };
}

/** Number of solutions, counting at most `limit` (e.g. 2 to test uniqueness). */
export function countSolutions(grid: Grid, limit = 2): number {
  if (findConflicts(grid).length > 0) return 0;
  const x = setup(grid, Math.random);
  if (!x) return 0;
  let count = 0;
  x.search(() => ++count >= limit);
  return count;
}

// --- helpers -------------------------------------------------------------

/** Parses an 81-char string; digits 1-9 are givens, anything else is empty. */
export function parseGrid(s: string): Grid {
  if (s.length !== N * N) throw new TypeError("expected 81 characters");
  return Array.from({ length: N }, (_, r) =>
    Array.from({ length: N }, (_, c) => {
      const ch = s[r * N + c];
      return ch >= "1" && ch <= "9" ? Number(ch) : 0;
    }),
  );
}

// --- next step: the forced fills ----------------------------------------------

export type Constraint = "cell" | "row" | "column" | "box";
export type ForcedFill = Cell & { value: number; because: Constraint };

export type NextStepResult =
  | { status: "fills"; fills: ForcedFill[] }
  | { status: "none" } //            no constraint is down to one candidate
  | { status: "stuck"; cell?: Cell } // a constraint has no candidate left
  | { status: "invalid"; conflicts: Cell[] }
  | { status: "complete" };

/**
 * The fills the exact-cover matrix forces right now: every constraint column
 * left with exactly one candidate row. In sudoku words, a cell with one
 * possible digit ("cell"), or a digit with one possible place in a row,
 * column or box. Each cell is listed once.
 */
export function nextStep(grid: Grid): NextStepResult {
  const conflicts = findConflicts(grid);
  if (conflicts.length) return { status: "invalid", conflicts };
  if (grid.every((row) => row.every((v) => v !== 0))) return { status: "complete" };

  // candidates still possible after the givens are placed
  const alive = new Uint8Array(ROWS).fill(1);
  const satisfied = new Uint8Array(COLS);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const v = grid[r][c];
      if (!v) continue;
      for (const col of rowCols[candidateIndex(r, c, v - 1)]) {
        satisfied[col] = 1;
        for (const other of colRows[col]) alive[other] = 0;
      }
    }
  }

  const kinds: Constraint[] = ["cell", "row", "column", "box"];
  const fills = new Map<number, ForcedFill>();
  for (let col = 0; col < COLS; col++) {
    if (satisfied[col]) continue;
    const left = colRows[col].filter((idx) => alive[idx]);
    if (left.length === 0) {
      const cell = col < N * N ? { row: Math.floor(col / N), col: col % N } : undefined;
      return { status: "stuck", cell };
    }
    if (left.length !== 1) continue;
    const idx = left[0];
    const row = Math.floor(idx / (N * N));
    const c = Math.floor(idx / N) % N;
    const cellKey = row * N + c;
    if (!fills.has(cellKey)) {
      fills.set(cellKey, { row, col: c, value: (idx % N) + 1, because: kinds[Math.floor(col / (N * N))] });
    }
  }
  if (fills.size === 0) return { status: "none" };
  return { status: "fills", fills: [...fills.values()] };
}

// --- why a fill is forced ---------------------------------------------------------

const BOX_NAMES = ["top-left", "top", "top-right", "left", "middle", "right", "bottom-left", "bottom", "bottom-right"];
const boxOf = (r: number, c: number) => Math.floor(r / 3) * 3 + Math.floor(c / 3);

function list(items: (string | number)[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * Explains a forced fill from nextStep() in plain words, tracing it back to the
 * rows, columns and boxes that rule everything else out.
 */
export function explainFill(grid: Grid, f: ForcedFill): string {
  const { row, col, value } = f;
  const box = boxOf(row, col);
  const inRow = (r: number, v: number) => grid[r].includes(v);
  const inCol = (c: number, v: number) => grid.some((line) => line[c] === v);
  const inBox = (b: number, v: number) => {
    const r0 = Math.floor(b / 3) * 3;
    const c0 = (b % 3) * 3;
    for (let r = r0; r < r0 + 3; r++) for (let c = c0; c < c0 + 3; c++) if (grid[r][c] === v) return true;
    return false;
  };
  const where = `row ${row + 1}, column ${col + 1}`;
  const a = value === 8 ? "an" : "a"; // "an 8"

  if (f.because === "cell") {
    // every other digit is already in this cell's row, column or box
    const others = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => d !== value);
    const byRow = others.filter((d) => inRow(row, d));
    const byCol = others.filter((d) => !byRow.includes(d) && inCol(col, d));
    const byBox = others.filter((d) => !byRow.includes(d) && !byCol.includes(d) && inBox(box, d));
    const parts = [
      byRow.length ? `row ${row + 1} already has ${list(byRow)}` : "",
      byCol.length ? `column ${col + 1} adds ${list(byCol)}` : "",
      byBox.length ? `the ${BOX_NAMES[box]} box adds ${list(byBox)}` : "",
    ].filter(Boolean);
    const joined = parts.length > 1 ? `${parts.slice(0, -1).join("; ")}; and ${parts[parts.length - 1]}` : parts[0];
    return `The ${value} at ${where}: ${joined}. That leaves only ${value}.`;
  }

  // a digit with one place left in a row, column or box: name what blocks the other free cells
  const unit =
    f.because === "row"
      ? { name: `row ${row + 1}`, cells: Array.from({ length: 9 }, (_, c) => [row, c] as const) }
      : f.because === "column"
        ? { name: `column ${col + 1}`, cells: Array.from({ length: 9 }, (_, r) => [r, col] as const) }
        : {
            name: `the ${BOX_NAMES[box]} box`,
            cells: Array.from({ length: 9 }, (_, i) => [Math.floor(box / 3) * 3 + Math.floor(i / 3), (box % 3) * 3 + (i % 3)] as const),
          };
  const blockers = new Set<string>();
  for (const [r, c] of unit.cells) {
    if ((r === row && c === col) || grid[r][c]) continue;
    // the reason this free cell can't take the digit
    if (f.because !== "row" && inRow(r, value)) blockers.add(`row ${r + 1}`);
    else if (f.because !== "column" && inCol(c, value)) blockers.add(`column ${c + 1}`);
    else if (f.because !== "box" && inBox(boxOf(r, c), value)) blockers.add(`the ${BOX_NAMES[boxOf(r, c)]} box`);
  }
  const reason = blockers.size
    ? `every other free cell is blocked, because ${list([...blockers])} already ${blockers.size === 1 ? "has" : "have"} ${a} ${value}`
    : "it is the only free cell left";
  return `The ${value} at ${where}: ${unit.name} needs ${a} ${value}, and ${reason}. So it must go here.`;
}
