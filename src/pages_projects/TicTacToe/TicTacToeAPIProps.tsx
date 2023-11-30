import React from "react";

export type TicTacToeAPIProps = {
  nickname: string;
  roomNumber: number;
  setMenuState: React.Dispatch<React.SetStateAction<string>>;
};
export type GameState = {
  board: number[][];
  turn: boolean | null;
  draw: boolean;
  lose: boolean;
  win: boolean;
};
export type StateData = {
  authToken: string;
  setAuthToken: React.Dispatch<React.SetStateAction<string>>;
  playerId: number;
  setPlayerId: React.Dispatch<React.SetStateAction<number>>;
  playerNumber: number;
  setPlayerNumber: React.Dispatch<React.SetStateAction<number>>;
  roomState: string;
  setRoomState: React.Dispatch<React.SetStateAction<string>>;
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  opponent: string;
  setOpponent: React.Dispatch<React.SetStateAction<string>>;
  websocket: WebSocket;
  setMenuState: React.Dispatch<React.SetStateAction<string>>;
  nickname: string;
  roomNumber: number;
};
export interface InitialResponse {
  msg_NAME: "InitialResponse";
  errorMsg: string;
  authToken: string;
  playerId: number;
  roomId: number;
}
export interface GameStartResponse {
  msg_NAME: "GameStartResponse";
  roomId: number;
  player1Id: number;
  player2Id: number;
  player1Nickname: string;
  player2Nickname: string;
  player1Turn: boolean;
}
export interface GameUpdateResponse {
  msg_NAME: "GameUpdateResponse";
  errorMsg: string;
  x: number;
  y: number;
  playerId: number;
  roomId: number;
  win: boolean;
  lose: boolean;
  draw: boolean;
  gameEnd: boolean;
}
export interface TurnResponse {
  msg_NAME: "TurnResponse";
  errorMsg: string;
  wrongTurn: boolean;
  valid: boolean;
  x: number;
  y: number;
  win: boolean;
  lose: boolean;
  draw: boolean;
  gameEnd: boolean;
}
export interface InitialRequest {
  msg_NAME: "InitialRequest";
  nickname: string;
  roomId: number;
}
export interface TurnRequest {
  msg_NAME: "TurnRequest";
  playerId: number;
  authToken: string;
  x: number;
  y: number;
}
export interface GameUpdate {
  x: number;
  y: number;
  win: boolean;
  lose: boolean;
  draw: boolean;
  gameEnd: boolean;
}
