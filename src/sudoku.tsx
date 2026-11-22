import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { explainFill, findConflicts, nextStep, parseGrid, solve, type Grid } from "./lib/sudoku/solver";
import examples from "./lib/sudoku/examples.json";
import "./styles.css";

const EMPTY = Array<string>(81).fill("");
type Mark = "given" | "step" | "solved";
type Status = { text: string; tone: "plain" | "good" | "bad" };


function toGrid(cells: string[]): Grid {
  return Array.from({ length: 9 }, (_, r) => cells.slice(r * 9, r * 9 + 9).map((v) => (v ? Number(v) : 0)));
}

/** Draws a stored example, never the same one twice in a row. */
function drawExample(last: number): number {
  let i = last;
  while (i === last) i = Math.floor(Math.random() * examples.length);
  return i;
}

function cellClass(i: number, mark: Mark | undefined, conflict: boolean, fresh: boolean): string {
  const r = Math.floor(i / 9);
  const c = i % 9;
  return [
    "size-full min-w-0 border-0 bg-white p-0 text-center text-[clamp(1.1rem,4.8vw,1.6rem)] tabular-nums caret-plum outline-none transition-colors duration-300 focus:bg-lilac-deep",
    mark === "solved" ? "text-plum" : mark === "step" ? "font-medium text-plum" : "font-medium text-ink",
    conflict ? "bg-red-100 text-red-700" : fresh ? "bg-plum/25" : mark === "step" ? "bg-plum/10" : "",
    c === 2 || c === 5 ? "border-r-2 border-r-ink" : "",
    r === 2 || r === 5 ? "border-b-2 border-b-ink" : "",
  ].join(" ");
}

function SudokuApp() {
  const [cells, setCells] = useState<string[]>(EMPTY);
  const [marks, setMarks] = useState<(Mark | undefined)[]>(Array(81).fill(undefined));
  const [conflicts, setConflicts] = useState<Set<number>>(new Set());
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<Status>({ text: "", tone: "plain" });
  const [example, setExample] = useState(-1);
  // the grid as it was before Solve, so the solve can be taken back
  const [before, setBefore] = useState<{ cells: string[]; marks: (Mark | undefined)[] } | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const load = (next: string[], nextMarks: (Mark | undefined)[], text = "") => {
    setCells(next);
    setMarks(nextMarks);
    setConflicts(new Set());
    setFresh(new Set());
    setStatus({ text, tone: "plain" });
    setBefore(null);
  };

  const edit = (i: number, raw: string) => {
    const v = raw.replace(/[^1-9]/g, "").slice(-1);
    // typing after a solve: the solver's digits are stale, so clear them
    const solved = marks.some((m) => m === "solved");
    const next = cells.map((c, k) => (k === i ? v : solved && marks[k] === "solved" ? "" : c));
    const nextMarks = marks.map((m, k) => (k === i ? (v ? "given" : undefined) : solved && m === "solved" ? undefined : m));
    load(next, nextMarks);
    if (v && i < 80) inputs.current[i + 1]?.focus();
  };

  const move = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    const steps: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 9, ArrowUp: -9 };
    if (e.key in steps) {
      e.preventDefault();
      inputs.current[(i + steps[e.key] + 81) % 81]?.focus();
    } else if (e.key === "Backspace" && !cells[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  };

  const showConflicts = (bad: { row: number; col: number }[]) => {
    setConflicts(new Set(bad.map((c) => c.row * 9 + c.col)));
    setStatus({ text: "Some digits clash in a row, column or box. They are marked in red.", tone: "bad" });
  };

  const step = () => {
    const result = nextStep(toGrid(cells));
    if (result.status === "invalid") return showConflicts(result.conflicts);
    if (result.status === "complete") return setStatus({ text: "The grid is already full.", tone: "good" });
    if (result.status === "stuck") {
      return setStatus({ text: "A digit has nowhere left to go: this sudoku has no solution.", tone: "bad" });
    }
    if (result.status === "none") {
      return setStatus({ text: "No digit is forced right now. From here the solver has to try options: press Solve.", tone: "plain" });
    }
    // one digit at a time, with the reason it is forced
    const f = result.fills[0];
    const i = f.row * 9 + f.col;
    const next = cells.slice();
    const nextMarks = marks.slice();
    next[i] = String(f.value);
    nextMarks[i] = "step";
    setCells(next);
    setMarks(nextMarks);
    setConflicts(new Set());
    setFresh(new Set([i]));
    setStatus({ text: explainFill(toGrid(cells), f), tone: "plain" });
  };

  const run = () => {
    const grid = toGrid(cells);
    const bad = findConflicts(grid);
    if (bad.length) return showConflicts(bad);
    const started = performance.now();
    const result = solve(grid);
    const ms = Math.max(1, Math.round(performance.now() - started));
    if (result.status !== "solved") return setStatus({ text: "This sudoku has no solution.", tone: "bad" });
    setBefore({ cells, marks });
    setCells(result.grid.flat().map(String));
    setMarks(marks.map((m, i) => m ?? (cells[i] ? "given" : "solved")));
    setConflicts(new Set());
    setFresh(new Set());
    const empty = cells.every((c) => !c);
    setStatus({
      text: empty ? `An empty grid has many solutions; here is one, found in ${ms} ms.` : `Solved in ${ms} ms.`,
      tone: "good",
    });
  };

  const undo = () => {
    if (!before) return;
    setCells(before.cells);
    setMarks(before.marks);
    setFresh(new Set());
    setBefore(null);
    setStatus({ text: "Back to the puzzle before solving.", tone: "plain" });
  };

  const loadExample = () => {
    const i = drawExample(example);
    setExample(i);
    const g = parseGrid(examples[i]).flat();
    const givens = g.filter(Boolean).length;
    load(g.map((v) => (v ? String(v) : "")), g.map((v) => (v ? "given" : undefined)), `Example ${i + 1} of ${examples.length}: ${givens} digits given.`);
  };

  const tone = { plain: "text-muted", good: "text-plum", bad: "text-red-700" }[status.tone];
  const empty = cells.every((c) => !c);
  const solvedAll = cells.every(Boolean);

  return (
    <div className="grid gap-6 lg:grid-cols-[auto_1fr] lg:items-start lg:gap-12">
      <div
        className="grid aspect-square w-full max-w-[30rem] grid-cols-9 gap-px overflow-hidden rounded-2xl border-2 border-ink bg-ink/25 lg:w-[min(30rem,calc(100svh-15rem))]"
        role="group"
        aria-label="Sudoku grid"
      >
        {cells.map((v, i) => (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            value={v}
            inputMode="numeric"
            autoComplete="off"
            aria-label={`Row ${Math.floor(i / 9) + 1}, column ${(i % 9) + 1}`}
            className={cellClass(i, marks[i], conflicts.has(i), fresh.has(i))}
            onChange={(e) => edit(i, e.target.value)}
            onKeyDown={(e) => move(i, e)}
            onFocus={(e) => e.target.select()}
          />
        ))}
      </div>
      <div className="grid content-start gap-4 lg:max-w-sm">
        {/* the result sits right under the grid on a phone, before the buttons */}
        <p className={`min-h-6 text-lg ${tone} lg:order-last lg:min-h-12`} role="status">{status.text}</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          {empty ? (
            <>
              <button className="btn-primary" type="button" onClick={loadExample}>Load an example</button>
              <button className="btn-quiet" type="button" onClick={run}>Fill an empty grid</button>
            </>
          ) : (
            <>
              <button className="btn-primary" type="button" onClick={run} disabled={solvedAll}>Solve</button>
              <button className="btn-quiet" type="button" onClick={step} disabled={solvedAll}>Show the next step</button>
              <button className="btn-quiet" type="button" onClick={loadExample}>Another example</button>
              {before ? (
                <button className="btn-quiet" type="button" onClick={undo}>Back to the puzzle</button>
              ) : (
                <button className="btn-quiet" type="button" onClick={() => load(EMPTY, Array(81).fill(undefined))}>Clear the grid</button>
              )}
            </>
          )}
        </div>
        <ul className="grid gap-1.5 text-sm text-muted lg:order-last">
          <li><span className="font-medium text-ink">Black</span>: the puzzle</li>
          <li><span className="rounded bg-plum/10 px-1 font-medium text-plum">Tinted purple</span>: forced, found by the next step</li>
          <li><span className="font-medium text-plum">Purple</span>: found by the solver</li>
        </ul>
      </div>
    </div>
  );
}

createRoot(document.getElementById("app")!).render(<SudokuApp />);
