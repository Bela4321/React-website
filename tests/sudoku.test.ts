// Run with: npm run test:sudoku   (Node >= 23 runs .ts directly)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  solve,
  countSolutions,
  findConflicts,
  parseGrid,
  type Grid,
  type Rng,
} from "../src/lib/sudoku/solver.ts";

// ---- independent checker (does not reuse solver code) ----------------------

function assertValidSolution(puzzle: Grid, solution: Grid, label = "") {
  const units: number[][] = [];
  for (let i = 0; i < 9; i++) {
    units.push(solution[i]);
    units.push(solution.map((row) => row[i]));
    const br = Math.floor(i / 3) * 3;
    const bc = (i % 3) * 3;
    units.push(
      [0, 1, 2].flatMap((dr) => [0, 1, 2].map((dc) => solution[br + dr][bc + dc])),
    );
  }
  for (const unit of units) {
    assert.deepEqual([...unit].sort(), [1, 2, 3, 4, 5, 6, 7, 8, 9], `${label} unit ${unit}`);
  }
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (puzzle[r][c] !== 0) {
        assert.equal(solution[r][c], puzzle[r][c], `${label} given changed at ${r},${c}`);
      }
    }
  }
}

function solved(puzzle: Grid, rng?: Rng): Grid {
  const res = solve(puzzle, rng);
  assert.equal(res.status, "solved");
  if (res.status !== "solved") throw new Error();
  assertValidSolution(puzzle, res.grid);
  return res.grid;
}

/** small deterministic PRNG so failures are reproducible */
function mulberry32(seed: number): Rng {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const empty = (): Grid => Array.from({ length: 9 }, () => Array(9).fill(0));

// ---- known puzzles ---------------------------------------------------------

const KNOWN: Record<string, string> = {
  // the fixture the old Lambda solved in 843 ms
  lambdaFixture:
    "..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..",
  aiEscargot:
    "1....7.9..3..2...8..96..5....53..9...1..8...26....4...3......1..4......7..7...3..",
  inkala2012:
    "8..........36......7..9.2...5...7.......457.....1...3...1....68..85...1..9....4..",
  easterMonster:
    "1.......2.9.4...5...6...7...5.9.3.......7.......85..4.7.....6...3...9.8...2.....1",
};

for (const [name, s] of Object.entries(KNOWN)) {
  test(`known puzzle: ${name} is solved validly and has a unique solution`, () => {
    const puzzle = parseGrid(s);
    const t0 = performance.now();
    solved(puzzle);
    const ms = performance.now() - t0;
    assert.ok(ms < 1000, `took ${ms.toFixed(0)} ms`);
    assert.equal(countSolutions(puzzle, 2), 1);
  });
}

test("lambda fixture: same answer as the old API (puzzle is unique)", () => {
  const expected = [
    [4, 8, 3, 9, 2, 1, 6, 5, 7], [9, 6, 7, 3, 4, 5, 8, 2, 1], [2, 5, 1, 8, 7, 6, 4, 9, 3],
    [5, 4, 8, 1, 3, 2, 9, 7, 6], [7, 2, 9, 5, 6, 4, 1, 3, 8], [1, 3, 6, 7, 9, 8, 2, 4, 5],
    [3, 7, 2, 6, 8, 9, 5, 1, 4], [8, 1, 4, 2, 5, 3, 7, 6, 9], [6, 9, 5, 4, 1, 7, 3, 8, 2],
  ];
  assert.deepEqual(solved(parseGrid(KNOWN.lambdaFixture)), expected);
});

// ---- edge cases ------------------------------------------------------------

test("empty grid yields a valid grid, and different ones across runs", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 50; i++) seen.add(JSON.stringify(solved(empty())));
  assert.ok(seen.size > 40, `only ${seen.size} distinct solutions in 50 runs`);
});

test("already complete valid grid is returned unchanged", () => {
  const full = solved(empty(), mulberry32(1));
  assert.deepEqual(solved(full), full);
});

test("single given", () => {
  const g = empty();
  g[4][4] = 7;
  solved(g);
});

test("duplicate in row / column / box is reported as invalid with the cells", () => {
  const row = empty();
  row[0][0] = 5; row[0][8] = 5;
  const col = empty();
  col[0][3] = 2; col[8][3] = 2;
  const box = empty();
  box[3][3] = 9; box[5][5] = 9;
  for (const [g, cells] of [
    [row, [{ row: 0, col: 0 }, { row: 0, col: 8 }]],
    [col, [{ row: 0, col: 3 }, { row: 8, col: 3 }]],
    [box, [{ row: 3, col: 3 }, { row: 5, col: 5 }]],
  ] as const) {
    const res = solve(g);
    assert.equal(res.status, "invalid");
    if (res.status === "invalid") assert.deepEqual(res.conflicts, cells);
  }
});

test("no duplicates but unsolvable (cell forced to 9 that is blocked)", () => {
  // row 0 needs a 9 at (0,8), but (1,8) already holds 9
  const g = parseGrid("12345678." + "........9" + ".".repeat(63));
  assert.equal(findConflicts(g).length, 0);
  assert.deepEqual(solve(g), { status: "unsolvable" });
  assert.equal(countSolutions(g), 0);
});

test("unsolvable: cell with no candidates left", () => {
  // (0,0) sees 1-8 in its row/col/box and 9 in its column
  const g = parseGrid(".12345678" + "9........" + ".".repeat(63));
  // the row needs a 9 somewhere in row 0, only (0,0) is free, but col 0 has 9
  assert.equal(findConflicts(g).length, 0);
  assert.equal(solve(g).status, "unsolvable");
});

test("puzzle with multiple solutions: each returned one is valid", () => {
  const g = parseGrid(KNOWN.aiEscargot.replace(/[1-9]/, ".")); // drop a clue
  assert.equal(countSolutions(g, 2), 2);
  for (let i = 0; i < 20; i++) solved(g);
});

test("malformed input throws", () => {
  assert.throws(() => solve([] as Grid));
  assert.throws(() => solve(empty().slice(0, 8)));
  const bad = empty();
  bad[0][0] = 10;
  assert.throws(() => solve(bad));
  const frac = empty();
  frac[0][0] = 1.5;
  assert.throws(() => solve(frac));
  assert.throws(() => parseGrid("123"));
});

// ---- randomised bulk tests -------------------------------------------------

test("2000 random puzzles with 0-81 givens are solved validly", () => {
  const rng = mulberry32(42);
  let worst = 0;
  for (let i = 0; i < 2000; i++) {
    const full = solved(empty(), rng);
    const keep = Math.floor(rng() * 82);
    const cells = [...Array(81).keys()];
    for (let j = cells.length - 1; j > 0; j--) {
      const k = Math.floor(rng() * (j + 1));
      [cells[j], cells[k]] = [cells[k], cells[j]];
    }
    const puzzle = empty();
    for (const idx of cells.slice(0, keep)) {
      puzzle[Math.floor(idx / 9)][idx % 9] = full[Math.floor(idx / 9)][idx % 9];
    }
    const t0 = performance.now();
    solved(puzzle, rng);
    worst = Math.max(worst, performance.now() - t0);
  }
  assert.ok(worst < 500, `slowest solve ${worst.toFixed(0)} ms`);
});

test("random givens that are consistent but may be unsolvable never return a wrong grid", () => {
  const rng = mulberry32(7);
  const outcomes = { solved: 0, unsolvable: 0, invalid: 0 };
  for (let i = 0; i < 2000; i++) {
    const g = empty();
    const n = 5 + Math.floor(rng() * 40);
    const allowDuplicates = i % 4 === 0; // 1/4 may contain direct conflicts
    for (let j = 0; j < n; j++) {
      const r = Math.floor(rng() * 9);
      const c = Math.floor(rng() * 9);
      const prev = g[r][c];
      g[r][c] = 1 + Math.floor(rng() * 9);
      if (!allowDuplicates && findConflicts(g).length > 0) g[r][c] = prev;
    }
    const res = solve(g, rng);
    outcomes[res.status]++;
    if (res.status === "solved") assertValidSolution(g, res.grid);
    if (res.status === "invalid") assert.ok(res.conflicts.length >= 2);
    if (res.status === "unsolvable") assert.equal(countSolutions(g, 1), 0);
  }
  // make sure all three branches were actually exercised
  assert.ok(outcomes.solved > 0 && outcomes.unsolvable > 0 && outcomes.invalid > 0,
    JSON.stringify(outcomes));
});

test("minimal unique puzzles (no clue can be removed) are solved validly", () => {
  const rng = mulberry32(2026);
  for (let i = 0; i < 20; i++) {
    const puzzle = solved(empty(), rng);
    const order = [...Array(81).keys()].sort(() => rng() - 0.5);
    for (const idx of order) {
      const r = Math.floor(idx / 9), c = idx % 9;
      const v = puzzle[r][c];
      puzzle[r][c] = 0;
      if (countSolutions(puzzle, 2) !== 1) puzzle[r][c] = v;
    }
    const clues = puzzle.flat().filter(Boolean).length;
    assert.ok(clues >= 17 && clues <= 35, `${clues} clues`);
    solved(puzzle, rng);
    assert.equal(countSolutions(puzzle, 2), 1);
  }
});
