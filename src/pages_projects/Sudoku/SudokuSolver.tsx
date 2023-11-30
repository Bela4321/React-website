import "../../css/SudokuSolver.css";
import CallSolverAPI from "./CallSolverAPI";
import { useEffect } from "react";

export default function SudokuSolver() {
  useEffect(() => {
    CallSolverAPI();
  }, []);
  return (
    <>
      <br />
      <form id="sudokuInput">
        <table id="grid" border={1}>
          <tbody>
            <tr className="sudokuRow">
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[0][0]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[0][1]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[0][2]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[0][3]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[0][4]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[0][5]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[0][6]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[0][7]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[0][8]"
                />
              </td>
            </tr>

            <tr className="sudokuRow">
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[1][0]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[1][1]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[1][2]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[1][3]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[1][4]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[1][5]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[1][6]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[1][7]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[1][8]"
                />
              </td>
            </tr>

            <tr className="sudokuRow">
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[2][0]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[2][1]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[2][2]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[2][3]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[2][4]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[2][5]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[2][6]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[2][7]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[2][8]"
                />
              </td>
            </tr>

            <tr className="sudokuRow">
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[3][0]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[3][1]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[3][2]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[3][3]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[3][4]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[3][5]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[3][6]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[3][7]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[3][8]"
                />
              </td>
            </tr>

            <tr className="sudokuRow">
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[4][0]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[4][1]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[4][2]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[4][3]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[4][4]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[4][5]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[4][6]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[4][7]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[4][8]"
                />
              </td>
            </tr>

            <tr className="sudokuRow">
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[5][0]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[5][1]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[5][2]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[5][3]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[5][4]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[5][5]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[5][6]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[5][7]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[5][8]"
                />
              </td>
            </tr>

            <tr className="sudokuRow">
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[6][0]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[6][1]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[6][2]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[6][3]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[6][4]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[6][5]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[6][6]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[6][7]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[6][8]"
                />
              </td>
            </tr>

            <tr className="sudokuRow">
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[7][0]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[7][1]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[7][2]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[7][3]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[7][4]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[7][5]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[7][6]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[7][7]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[7][8]"
                />
              </td>
            </tr>

            <tr className="sudokuRow">
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[8][0]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[8][1]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[8][2]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[8][3]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[8][4]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[8][5]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[8][6]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[8][7]"
                />
              </td>
              <td className="cell">
                <input
                  type="text"
                  maxLength={1}
                  pattern="[1-9]"
                  name="matrix[8][8]"
                />
              </td>
            </tr>
          </tbody>
        </table>
        <br />
        <input type="submit" value="Solve" />
      </form>
      <p id="result"></p>
    </>
  );
}
