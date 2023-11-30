import { StateData } from "./TicTacToeAPIProps";
import { sendTurnRequest } from "./TicTacToeAPI";

export function displayBoard(stateData: StateData, ws: WebSocket) {
  return (
    <>
      <div id="TicTacToeBoard">
        {stateData.gameState.board.map((row: number[], x: number) => {
          return (
            <div className="TicTacToeRow" key={x}>
              {row.map((cell: number, y: number) => {
                return (
                  <div className="TicTacToeCell" key={y}>
                    {cell == 0 ? (
                      <button
                        className="TicTacToeButton"
                        onClick={() => {
                          handleClick(stateData, x, y, ws);
                        }}
                      >
                        {" "}
                      </button>
                    ) : cell == 1 ? (
                      <p>X</p>
                    ) : (
                      <p>O</p>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div id="gameInfo">
        <p>Opponent: {stateData.opponent}</p>
        <p>{stateData.gameState.turn ? "your turn" : "opponent's turn"}</p>
      </div>
    </>
  );
}
function handleClick(
  stateData: StateData,
  x: number,
  y: number,
  ws: WebSocket
) {
  //check turn
  if (!stateData.gameState.turn) {
    alert("not your turn");
    return;
  }
  //check if cell is empty
  if (stateData.gameState.board[x][y] != 0) {
    alert("cell already occupied");
    return;
  }
  //send turn request
  sendTurnRequest(stateData, x, y, ws);
}
