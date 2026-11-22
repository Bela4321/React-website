import { solve } from "../../lib/sudoku/solver";

function CallSolverAPI() {
  const form = document.getElementById("sudokuInput") as HTMLFormElement;
  form.addEventListener("submit", function (e) {
    e.preventDefault();

    // Get the form data as a 2D array
    const formData = new FormData(this);
    const matrix: number[][] = [];
    for (let i = 0; i < 9; i++) {
      matrix[i] = [];
      for (let j = 0; j < 9; j++) {
        const value = formData.get(`matrix[${i}][${j}]`);
        matrix[i][j] = value ? parseFloat(value as string) : NaN;
      }
    }

    const result = document.getElementById("result");
    if (result) {
      result.innerText = "Matrix submitted";
    }

    //check validity
    const validity = isValidSudoku(matrix);
    if (validity.length != 0) {
      alert(validity);
      return;
    }
    // solve in the browser (no server needed)
    const grid = matrix.map((row) => row.map((v) => (isNaN(v) ? 0 : v)));
    const started = performance.now();
    let outcome;
    try {
      outcome = solve(grid);
    } catch {
      if (result) result.innerText = "Please use only the numbers 1 to 9";
      return;
    }
    const ms = Math.round(performance.now() - started);
    if (outcome.status === "solved") {
      displaySolution(outcome.grid);
      if (result) result.innerText = "Solved in " + ms + "ms";
    } else if (result) {
      result.innerText = "This sudoku has no solution";
    }
  });
}

function displaySolution(matrix: number[][]) {
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      const name = `matrix[${i}][${j}]`;
      const inputElement = document.querySelector<HTMLInputElement>(
        'input[name="' + name + '"]'
      );
      if (inputElement) {
        inputElement.value = matrix[i][j].toString();
      }
    }
  }
}

function isValidSudoku(board: number[][]) {
  // Helper function to check if an array of numbers contains duplicates
  function hasDuplicates(arr: number[]) {
    const seen = new Set<number>();
    for (let num of arr) {
      if (!isNaN(num) && seen.has(num)) {
        return true;
      }
      seen.add(num);
    }
    return false;
  }
  // Check rows
  for (let row = 0; row < 9; row++) {
    if (hasDuplicates(board[row])) {
      return "Duplicate in line " + (row + 1);
    }
  }
  // Check columns
  for (let col = 0; col < 9; col++) {
    const column: number[] = [];
    for (let row = 0; row < 9; row++) {
      column.push(board[row][col]);
    }
    if (hasDuplicates(column)) {
      return "Duplicate in column " + (col + 1);
    }
  }

  // Check 3x3 subgrids
  for (let i = 0; i < 9; i += 3) {
    for (let j = 0; j < 9; j += 3) {
      const subgrid: number[] = [];
      for (let row = i; row < i + 3; row++) {
        for (let col = j; col < j + 3; col++) {
          subgrid.push(board[row][col]);
        }
      }
      if (hasDuplicates(subgrid)) {
        return "Duplicate in box " + i / 3 + j / 3;
      }
    }
  }

  return "";
}

export default CallSolverAPI;
