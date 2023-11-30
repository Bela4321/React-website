import { useEffect, useRef, useState } from "react";
/*import Data types*/
import {
  TicTacToeAPIProps,
  GameState,
  StateData,
  InitialResponse,
  GameStartResponse,
  GameUpdateResponse,
  TurnResponse,
  TurnRequest,
  InitialRequest,
} from "./TicTacToeAPIProps";
import { displayBoard } from "./displayBoard";

export default function TicTacToeAPI({
  nickname,
  roomNumber,
  setMenuState,
}: TicTacToeAPIProps) {
  //websocket
  const wsRef = useRef(new WebSocket("ws://localhost:8080/ticTacToe"));

  //close hook
  const menuStateRef = useRef(setMenuState);

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
  };
  //websocket
  wsRef.current.addEventListener("open", (event) => {
    console.log("WebSocket connection opened:", event);
    sendInitialMessage(wsRef.current, nickname, roomNumber);
  });
  wsRef.current.addEventListener("message", (event) => {
    console.log("Message from server:", event.data);
    handleMessage(event, stateData);
  });
  wsRef.current.addEventListener("close", (event) => {
    console.log("WebSocket connection closed:", event);
    setRoomState("gameEnded");
  });

  const leaveRoom = () => {
    wsRef.current.close();
    setMenuState("login");
  };

  switch (roomState) {
    case "notConnected":
      return (
        <>
          <p>
            Not connected
            <br />
            trying to establish a connection with room {roomNumber} as
            {nickname}
          </p>
          <button onClick={leaveRoom}>Abort</button>
        </>
      );
    case "waitingForPlayer":
      return (
        <>
          <p>
            Waiting for second Player in room {roomNumber} as {nickname}.
          </p>
          <button onClick={leaveRoom}>Leave</button>
        </>
      );
    case "ingame":
      return (
        <>
          {displayBoard(stateData, wsRef.current)}
          <button onClick={leaveRoom}>Quit</button>
        </>
      );
    case "gameEnded":
      return (
        <>
          {displayBoard(stateData, wsRef.current)}
          <p>Game ended:{resultDisplay(stateData)}</p>
          <button onClick={leaveRoom}>New</button>
        </>
      );
    default:
      return (
        <>
          <p>{roomState}</p>
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
  ws.send(
    "TurnRequest:authToken," +
      stateData.authToken +
      ",playerId," +
      stateData.playerId +
      ",x," +
      x +
      ",y," +
      y
  );
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
  ws.send("InitialRequest:nickname," + nickname + ";roomId," + roomNumber);
}

//sort message and call appropriate function
function handleMessage(message: MessageEvent, stateData: StateData) {
  //parse message json
  const messageJson = JSON.parse(message.data);
  //sort message
  switch (messageJson.msg_NAME) {
    case "InitialResponse":
      handleInitialResponse(messageJson, stateData);
      break;
    case "GameStartResponse":
      handleGameStartResponse(messageJson, stateData);
      break;
    case "GameUpdateResponse":
      handleGameUpdateResponse(messageJson, stateData);
      break;
    case "TurnResponse":
      handleTurnResponse(messageJson, stateData);
      break;
  }
}

function handleTurnResponse(messageJson: any, stateData: StateData) {
  //check validity of message
  if (messageJson.ErrorMsg != "" || !messageJson.valid) {
    alert(messageJson.ErrorMsg);
    return;
  }
  //update board
  const new_board = messageJson.Board;
  new_board[messageJson.X][messageJson.Y] = stateData.playerNumber;
  stateData.setGameState({
    ...stateData.gameState,
    board: new_board,
  });
  //set turn
  stateData.setGameState({
    ...stateData.gameState,
    turn: false,
  });
}

function handleGameUpdateResponse(messageJson: any, stateData: StateData) {
  //check validity of message
  if (messageJson.ErrorMsg != "") {
    alert(messageJson.ErrorMsg);
    return;
  }
  //update board
  const new_board = messageJson.Board;
  new_board[messageJson.X][messageJson.Y] = 3 - stateData.playerNumber;
  stateData.setGameState({
    ...stateData.gameState,
    board: new_board,
    turn: true,
  });
  //check if game ended
  if (!messageJson.gameEnd) {
    return;
  }
  //set win, lose or draw
  stateData.setGameState({
    ...stateData.gameState,
    win: messageJson.win,
    lose: messageJson.lose,
    draw: messageJson.draw,
  });
  //set gameEnded
  stateData.setRoomState("gameEnded");
}

function handleGameStartResponse(messageJson: any, stateData: StateData) {
  //find out if player is player1 or player2
  const isPlayer1 = messageJson.player1Id == stateData.playerId;

  //set playerNumber
  if (isPlayer1) {
    stateData.setPlayerNumber(1);
  } else {
    stateData.setPlayerNumber(2);
  }
  //set turn
  if (isPlayer1 == messageJson.player1Turn) {
    stateData.setGameState({
      ...stateData.gameState,
      turn: true,
    });
  } else {
    stateData.setGameState({
      ...stateData.gameState,
      turn: false,
    });
  }

  //set opponent
  if (isPlayer1) {
    stateData.setOpponent(messageJson.player2Nickname);
  } else {
    stateData.setOpponent(messageJson.player1Nickname);
  }
}

function handleInitialResponse(messageJson: any, stateData: StateData) {
  //check if message is conform with InitialResponse interface
  try {
    const initialResponse: InitialResponse = messageJson;
  } catch {
    alert("messageJson not conform with InitialResponse interface");
    return;
  }
  console.log(messageJson);
  //check if initialization was unsuccessful
  if (!(messageJson.errorMsg == "")) {
    alert(messageJson.errorMsg);
    //return to login
    stateData.setRoomState("couldn't connect to room");
    return;
  }
  //set authToken
  stateData.setAuthToken(messageJson.authToken);
  //set playerId
  stateData.setPlayerId(messageJson.playerId);
  //set roomState
  stateData.setRoomState("waitingForPlayer");
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
