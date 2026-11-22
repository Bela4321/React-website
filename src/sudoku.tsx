import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { findConflicts, parseGrid, solve, type Grid } from "./lib/sudoku/solver";
import "./apps.css";

// A hard puzzle with one solution, for "Load an example".
const EXAMPLE = "8..........36......7..9.2...5...7.......457.....1...3...1....68..85...1..9....4..";
const EMPTY = Array<string>(81).fill("");

function toGrid(cells: string[]): Grid {
  return Array.from({ length: 9 }, (_, r) =>
    cells.slice(r * 9, r * 9 + 9).map((v) => (v ? Number(v) : 0)),
  );
}

function SudokuApp() {
  const [cells, setCells] = useState<string[]>(EMPTY);
  const [solved, setSolved] = useState<boolean[]>(Array(81).fill(false));
  const [conflicts, setConflicts] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState({ text: "", error: false });
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const reset = (next: string[]) => {
    setCells(next);
    setSolved(Array(81).fill(false));
    setConflicts(new Set());
    setStatus({ text: "", error: false });
  };

  const edit = (i: number, raw: string) => {
    const v = raw.replace(/[^1-9]/g, "").slice(-1);
    const next = cells.slice();
    next[i] = v;
    // a new digit makes earlier solver output stale
    reset(solved.some(Boolean) ? next.map((c, k) => (solved[k] && k !== i ? "" : c)) : next);
    if (v && i < 80) inputs.current[i + 1]?.focus();
  };

  const move = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 9, ArrowUp: -9 }[e.key];
    if (step !== undefined) {
      e.preventDefault();
      inputs.current[(i + step + 81) % 81]?.focus();
    } else if (e.key === "Backspace" && !cells[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  };

  const run = () => {
    const grid = toGrid(cells);
    const bad = findConflicts(grid);
    if (bad.length) {
      setConflicts(new Set(bad.map((c) => c.row * 9 + c.col)));
      setStatus({ text: "Some digits clash in a row, column or box. They are marked.", error: true });
      return;
    }
    const started = performance.now();
    const result = solve(grid);
    const ms = Math.max(1, Math.round(performance.now() - started));
    if (result.status === "solved") {
      const flat = result.grid.flat().map(String);
      setSolved(cells.map((c) => !c));
      setCells(flat);
      setConflicts(new Set());
      setStatus({ text: `Solved in ${ms} ms.`, error: false });
    } else {
      setStatus({ text: "This sudoku has no solution.", error: true });
    }
  };

  const example = () => {
    const g = parseGrid(EXAMPLE);
    reset(g.flat().map((v) => (v ? String(v) : "")));
  };

  return (
    <div className="app">
      <div className="sudoku" role="group" aria-label="Sudoku grid">
        {cells.map((v, i) => (
          <input
            key={i}
            ref={(el) => (inputs.current[i] = el)}
            value={v}
            inputMode="numeric"
            autoComplete="off"
            maxLength={2}
            aria-label={`Row ${Math.floor(i / 9) + 1}, column ${(i % 9) + 1}`}
            className={[solved[i] ? "is-solved" : "", conflicts.has(i) ? "is-conflict" : ""].join(" ").trim() || undefined}
            onChange={(e) => edit(i, e.target.value)}
            onKeyDown={(e) => move(i, e)}
            onFocus={(e) => e.target.select()}
          />
        ))}
      </div>
      <div className="btn-row">
        <button className="btn btn--primary" type="button" onClick={run}>Solve the sudoku</button>
        <button className="btn btn--secondary" type="button" onClick={example}>Load an example</button>
        <button className="btn btn--secondary" type="button" onClick={() => reset(EMPTY)}>Clear the grid</button>
      </div>
      <p className={status.error ? "status is-error" : "status"} role="status">{status.text}</p>
    </div>
  );
}

createRoot(document.getElementById("app")!).render(<SudokuApp />);
