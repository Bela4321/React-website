import {
  StateData,
  InitialResponse,
  GameUpdate,
  TurnResponse,
  GameUpdateResponse,
  GameStartResponse,
} from "./TicTacToeAPIProps";

//sort message and call appropriate function
export function handleMessage(message: MessageEvent, stateData: StateData) {
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
function handleTurnResponse(turnResponse: TurnResponse, stateData: StateData) {
  //check validity of message
  if (turnResponse.errorMsg != "" || !turnResponse.valid) {
    alert(turnResponse.errorMsg);
    return;
  }
  //update game
  const gameUpdate: GameUpdate = turnResponse;
  //which player makes the move
  const movingPlayerNumber = stateData.playerNumber;
  updateGame(gameUpdate, stateData, movingPlayerNumber);
}
function handleGameUpdateResponse(
  gameUpdateResponse: GameUpdateResponse,
  stateData: StateData
) {
  //check validity of message
  if (gameUpdateResponse.errorMsg != "") {
    alert(gameUpdateResponse.errorMsg);
    return;
  }
  //game update
  const gameUpdate: GameUpdate = gameUpdateResponse;
  //which player makes the move
  const movingPlayerNumber = 3 - stateData.playerNumber;
  updateGame(gameUpdate, stateData, movingPlayerNumber);
}
function handleGameStartResponse(
  gameStartResponse: GameStartResponse,
  stateData: StateData
) {
  //find out if player is player1 or player2
  const isPlayer1 = gameStartResponse.player1Id == stateData.playerId;

  //set playerNumber
  if (isPlayer1) {
    stateData.setPlayerNumber(1);
  } else {
    stateData.setPlayerNumber(2);
  }
  //set turn
  if (isPlayer1 == gameStartResponse.player1Turn) {
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
    stateData.setOpponent(gameStartResponse.player2Nickname);
  } else {
    stateData.setOpponent(gameStartResponse.player1Nickname);
  }
  //set roomState
  stateData.setRoomState("ingame");
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

function updateGame(
  gameUpdate: GameUpdate,
  stateData: StateData,
  movingPlayerNumber: number
) {
  //update board
  const new_board = stateData.gameState.board;
  new_board[gameUpdate.x][gameUpdate.y] = 3 - movingPlayerNumber;
  stateData.setGameState({
    ...stateData.gameState,
    board: new_board,
    turn: !stateData.gameState.turn,
  });
  //check if game continues
  if (!gameUpdate.gameEnd) {
    return;
  }
  //set win, lose or draw
  stateData.setGameState({
    ...stateData.gameState,
    win: gameUpdate.win,
    lose: gameUpdate.lose,
    draw: gameUpdate.draw,
  });
  //set gameEnded
  stateData.setRoomState("gameEnded");
}
