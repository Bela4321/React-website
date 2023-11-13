export {};
const socket = new WebSocket("ws://localhost:8080/ticTacToe");
//gamestate
const gamestate = {
  board: [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ],
  turn: true,
  draw: false,
  lose: false,
  win: false,
};

socket.addEventListener("open", (event) => {
  console.log("WebSocket connection established");
});

socket.addEventListener("message", (event) => {
  console.log("Message received:", event.data);
});

socket.addEventListener("close", (event) => {
  console.log("WebSocket connection closed");
});
