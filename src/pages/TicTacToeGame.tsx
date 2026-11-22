import React, { useEffect, useRef, useState } from "react";

// Game server: a Cloudflare Worker (repo website-games). One room per name,
// two players, the server sends the full state after every change.
const SERVER: string =
  import.meta.env.VITE_GAMES_URL ?? "wss://games.belaschinke.workers.dev";

type Mark = "X" | "O";
type RoomState = {
  type: "state";
  you: Mark;
  status: "waiting" | "paused" | "playing" | "over";
  players: Partial<Record<Mark, { name: string; connected: boolean }>>;
  board: (Mark | null)[];
  turn: Mark;
  winner: Mark | "draw" | null;
  line: number[] | null;
  rematch: Mark[];
};

type Props = {
  nickname: string;
  roomNumber: string;
  onLeave: () => void;
};

const CLOSE_ROOM_FULL = 4001;
const CLOSE_REPLACED = 4002;

/** One id per browser tab: a reload rejoins the same seat. */
function playerId(): string {
  try {
    let id = sessionStorage.getItem("ttt-pid");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("ttt-pid", id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export default function TicTacToeGame({ nickname, roomNumber, onLeave }: Props) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [notice, setNotice] = useState("Connecting…");
  const socket = useRef<WebSocket | null>(null);

  useEffect(() => {
    let leaving = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const pid = playerId();

    const connect = () => {
      const url =
        `${SERVER}/tictactoe/${encodeURIComponent(String(roomNumber))}` +
        `?name=${encodeURIComponent(nickname)}&pid=${pid}`;
      const ws = new WebSocket(url);
      socket.current = ws;
      ws.onopen = () => {
        attempt = 0;
        setNotice("");
      };
      ws.onmessage = (event) => {
        if (event.data === "pong") return;
        const msg = JSON.parse(event.data);
        if (msg.type === "state") {
          setRoom(msg);
          setNotice("");
        } else if (msg.type === "error") {
          setNotice(msg.message);
        }
      };
      ws.onclose = (event) => {
        if (leaving) return;
        if (event.code === CLOSE_ROOM_FULL) {
          setNotice("This room is full. Try another room number.");
          return;
        }
        if (event.code === CLOSE_REPLACED) {
          setNotice("This game was opened in another tab.");
          return;
        }
        setNotice("Connection lost, reconnecting…");
        retryTimer = setTimeout(connect, Math.min(1000 * 2 ** attempt++, 10000));
      };
    };

    connect();
    // keeps proxies from dropping an idle connection
    const ping = setInterval(() => {
      if (socket.current?.readyState === WebSocket.OPEN) socket.current.send("ping");
    }, 30000);

    return () => {
      leaving = true;
      clearTimeout(retryTimer);
      clearInterval(ping);
      socket.current?.close(1000); // a deliberate leave frees the seat
    };
  }, [nickname, roomNumber]);

  const send = (msg: object) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(msg));
  };
  const leave = onLeave;

  if (!room) {
    return (
      <div className="app">
        <p className="status" role="status">{notice}</p>
        <button className="btn btn--secondary" type="button" onClick={leave}>Pick another room</button>
      </div>
    );
  }

  const opponentMark: Mark = room.you === "X" ? "O" : "X";
  const opponent = room.players[opponentMark];
  const myTurn = room.status === "playing" && room.turn === room.you;

  let status: string;
  switch (room.status) {
    case "waiting":
      status = `Waiting for a second player in room ${roomNumber}. Send them the room number.`;
      break;
    case "paused":
      status = `${opponent?.name ?? "Your opponent"} lost the connection. Their seat is kept for two minutes.`;
      break;
    case "playing":
      status = myTurn ? "Your turn." : `${opponent?.name}'s turn.`;
      break;
    case "over":
      status =
        room.winner === "draw"
          ? `A draw with ${opponent?.name}.`
          : room.winner === room.you
            ? `You win against ${opponent?.name}.`
            : `${opponent?.name} wins this one.`;
      break;
  }

  return (
    <div className="app">
      <div className="game-info">
        <p className="t-lead" role="status">{status}</p>
        <p className="status">
          Room {roomNumber}, you play {room.you}
          {opponent ? ` against ${opponent.name}` : ""}.
          {notice ? ` ${notice}` : ""}
        </p>
      </div>
      <div className="ttt" role="group" aria-label="Board">
        {room.board.map((cell, i) =>
          cell === null ? (
            <button
              key={i}
              type="button"
              disabled={!myTurn}
              aria-label={`Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}, empty`}
              onClick={() => send({ type: "move", cell: i })}
            />
          ) : (
            <span key={i} className={room.line?.includes(i) ? "is-line" : undefined} aria-label={`Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}, ${cell}`} role="img">
              {cell}
            </span>
          ),
        )}
      </div>
      <div className="btn-row">
        {room.status === "over" &&
          (room.rematch.includes(room.you) ? (
            <p className="status">Waiting for {opponent?.name} to accept the rematch.</p>
          ) : (
            <button className="btn btn--primary" type="button" onClick={() => send({ type: "rematch" })}>Play a rematch</button>
          ))}
        <button className="btn btn--secondary" type="button" onClick={leave}>Leave the room</button>
      </div>
    </div>
  );
}
