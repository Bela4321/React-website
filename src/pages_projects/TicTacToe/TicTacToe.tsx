import "../../css/TicTacToe.css";

import React, { useState } from "react";
import TicTacToeAPI from "./TicTacToeAPI";

export default function TicTacToe() {
  const [menuState, setMenuState] = useState("login");
  const [nickname, setNickname] = useState("genericNickname");
  const [roomNumber, setRoomNumber] = useState(420);

  return (
    <div className="TicTacToe">
      <h1>Tic Tac Toe</h1>
      {(() => {
        switch (menuState) {
          case "login":
            return input(
              setMenuState,
              setNickname,
              setRoomNumber,
              nickname,
              roomNumber
            );
          case "game":
            return game(setMenuState, roomNumber, nickname);
          case "end":
            return end();
          default:
            return null;
        }
      })()}
    </div>
  );
}

function game(
  setMenuState: React.Dispatch<React.SetStateAction<string>>,
  roomNumber: number,
  nickname: string
) {
  return (
    <>
      <div id="metaData">
        <p>Room number: {roomNumber}</p>
        <p>Nickname: {nickname}</p>
      </div>
      <TicTacToeAPI
        nickname={nickname}
        roomNumber={roomNumber}
        setMenuState={setMenuState}
      />
    </>
  );
}

function end() {
  return <p>Game ended</p>;
}

function input(
  setMenuState: React.Dispatch<React.SetStateAction<string>>,
  setNickname: React.Dispatch<React.SetStateAction<string>>,
  setRoomNumber: React.Dispatch<React.SetStateAction<number>>,
  nickname: string,
  roomNumber: number
) {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.id === "nickname") {
      setNickname(e.target.value);
    } else if (e.target.id === "roomNumber") {
      setRoomNumber(parseInt(e.target.value));
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // validate input
    if (!nickname || !roomNumber) {
      alert("Please enter a nickname and room number");
      return;
    }
    // change menu state
    setMenuState("game");
  };

  return (
    <div id="playerInfoInput">
      <form className="playerInfo" onSubmit={handleSubmit}>
        <h3>Nickname</h3>
        <input
          type="text"
          id="nickname"
          value={nickname}
          onChange={handleInputChange}
        />
        <br />
        <h3>Room number</h3>
        <input
          type="number"
          id="roomNumber"
          value={roomNumber}
          onChange={handleInputChange}
        />
        <br />
        <input type="submit" value="Submit" />
      </form>
    </div>
  );
}
