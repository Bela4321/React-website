import "../css/TicTacToe.css";

import React, { useState } from "react";

export default function TicTacToe() {
  const [gameState, setGameState] = useState("login");
  const;

  return (
    <div className="TicTacToe">
      <h1>Tic Tac Toe</h1>
      {(() => {
        switch (gameState) {
          case "login":
            return input();
          case "game":
            return game();
          case "end":
            return end();
          default:
            return null;
        }
      })()}
    </div>
  );
}

function game() {
  return <p> game ongoing</p>;
}

function end() {
  return <p>Game ended</p>;
}

function input() {
  return (
    <div id="playerInfoInput">
      <form className="playerInfo">
        <h3>Nickname</h3>
        <input type="text" id="nickname" />
        <br />
        <h3>room number</h3>
        <input type="number" id="roomNumber" />
        <br />
        <input type="submit" value="submit" />
      </form>
    </div>
  );
}
document.getElementById("playerInfoInput")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const nickname =
    document.getElementById("playerInfoInput")?.children[0].children[1].value;
  const roomNumber =
    document.getElementById("playerInfoInput")?.children[1].children[1].value;
  console.log(nickname, roomNumber);
});