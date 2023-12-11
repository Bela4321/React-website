import { useEffect, useRef, useState } from "react";
/*import Data types*/
import {
  TicTacToeAPIProps,
  GameState,
  StateData,
  GameStartResponse,
  GameUpdateResponse,
  TurnResponse,
  TurnRequest,
  InitialRequest,
} from "./TicTacToeAPIProps";
import { displayBoard } from "./displayBoard";
import { handleMessage } from "./handleMessage";

export default function TicTacToeAPI({
  nickname,
  roomNumber,
  setMenuState,
}: TicTacToeAPIProps) {
  //websocket
  const [websocket, setWebsocket] = useState(
    new WebSocket("wss://api.belaschinke.com:8080/ticTacToe")
  );

  //set other data
  const [authToken, setAuthToken] = useState("");
  const [playerId, setPlayerId] = useState(0);
  const [playerNumber, setPlayerNumber] = useState(0);
  const [roomState, setRoomState] = useState("notConnected");
  const [opponent, setOpponent] = useState("opponentNicknamePlaceholder");

  //game data
  const [gameState, setGameState] = useState<GameState>({
    board: [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ],
    turn: null,
    draw: false,
    lose: false,
    win: false,
  });
  //aggregate states for easier use
  const stateData: StateData = {
    authToken: authToken,
    setAuthToken: setAuthToken,
    playerId: playerId,
    setPlayerId: setPlayerId,
    playerNumber: playerNumber,
    setPlayerNumber: setPlayerNumber,
    roomState: roomState,
    setRoomState: setRoomState,
    gameState: gameState,
    setGameState: setGameState,
    opponent: opponent,
    setOpponent: setOpponent,
    websocket: websocket,
    setMenuState: setMenuState,
    nickname: nickname,
    roomNumber: roomNumber,
  };
  //websocket
  websocket.addEventListener("open", (event) => {
    console.log("WebSocket connection opened:", event);
    sendInitialMessage(websocket, nickname, roomNumber);
  });
  websocket.addEventListener("message", (event) => {
    console.log("Message from server:", event.data);
    handleMessage(event, stateData);
  });
  websocket.addEventListener("close", (event) => {
    console.log("WebSocket connection closed:", event);
    setRoomState("gameEnded");
  });

  return renderTicTacToe(stateData);
}

function renderTicTacToe(stateData: StateData) {
  const leaveRoom = () => {
    stateData.websocket.close();
    stateData.setMenuState("login");
  };
  switch (stateData.roomState) {
    case "notConnected":
      return (
        <>
          <p>
            Not connected
            <br />
            trying to establish a connection with room {stateData.roomNumber} as
            {stateData.nickname}
          </p>
          <button onClick={leaveRoom}>Abort</button>
        </>
      );
    case "waitingForPlayer":
      return (
        <>
          <p>
            Waiting for second Player in room {stateData.roomNumber} as{" "}
            {stateData.nickname}.
          </p>
          <button onClick={leaveRoom}>Leave</button>
        </>
      );
    case "ingame":
      return (
        <>
          {displayBoard(stateData, stateData.websocket)}
          <button onClick={leaveRoom}>Quit</button>
        </>
      );
    case "gameEnded":
      return (
        <>
          {displayBoard(stateData, stateData.websocket)}
          <p>Game ended:{resultDisplay(stateData)}</p>
          <button onClick={leaveRoom}>New</button>
        </>
      );
    default:
      return (
        <>
          <p>{stateData.roomState}</p>
          <button onClick={leaveRoom}>New</button>
        </>
      );
  }
}

export function sendTurnRequest(
  stateData: StateData,
  x: number,
  y: number,
  ws: WebSocket
) {
  const turnRequest: TurnRequest = {
    msg_NAME: "TurnRequest",
    playerId: stateData.playerId,
    authToken: stateData.authToken,
    x: x,
    y: y,
  };
  ws.send(JSON.stringify(turnRequest));
}

function sendInitialMessage(
  ws: WebSocket,
  nickname: string,
  roomNumber: number
) {
  const initialRequest: InitialRequest = {
    msg_NAME: "InitialRequest",
    nickname: nickname,
    roomId: roomNumber,
  };
  ws.send(JSON.stringify(initialRequest));
}

function resultDisplay(stateData: StateData) {
  if (stateData.gameState.win) {
    return "win angainst " + stateData.opponent + "";
  } else if (stateData.gameState.lose) {
    return "lose against " + stateData.opponent + "";
  } else if (stateData.gameState.draw) {
    return "draw with " + stateData.opponent + "";
  } else {
    return "game stopped";
  }
}
