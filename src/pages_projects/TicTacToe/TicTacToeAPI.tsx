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
  roomNumber: number;
  setMenuState: React.Dispatch<React.SetStateAction<string>>;
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

export default function TicTacToeAPI({ nickname, roomNumber, setMenuState }: Props) {
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
  const leave = () => setMenuState("login");

  if (!room) {
    return (
      <>
        <p>{notice}</p>
        <button onClick={leave}>Back</button>
      </>
    );
  }

  const opponentMark: Mark = room.you === "X" ? "O" : "X";
  const opponent = room.players[opponentMark];
  const myTurn = room.status === "playing" && room.turn === room.you;

  let status: string;
  switch (room.status) {
    case "waiting":
      status = `Waiting for a second player in room ${roomNumber}…`;
      break;
    case "paused":
      status = `${opponent?.name ?? "Your opponent"} lost connection. Waiting for them to come back…`;
      break;
    case "playing":
      status = myTurn ? "Your turn" : `${opponent?.name}'s turn`;
      break;
    case "over":
      status =
        room.winner === "draw"
          ? `Draw with ${opponent?.name}`
          : room.winner === room.you
            ? `You win against ${opponent?.name}!`
            : `You lose against ${opponent?.name}`;
      break;
  }

  const rows = [0, 1, 2].map((r) => room.board.slice(r * 3, r * 3 + 3));
  return (
    <>
      <div id="TicTacToeBoard">
        {rows.map((row, r) => (
          <div className="TicTacToeRow" key={r}>
            {row.map((cell, c) => {
              const i = r * 3 + c;
              const won = room.line?.includes(i);
              return (
                <div
                  className="TicTacToeCell"
                  key={c}
                  style={won ? { background: "#d4f5d4" } : undefined}
                >
                  {cell === null ? (
                    <button
                      className="TicTacToeButton"
                      disabled={!myTurn}
                      aria-label={`Cell ${i + 1}`}
                      onClick={() => send({ type: "move", cell: i })}
                    >
                      {" "}
                    </button>
                  ) : (
                    <p>{cell}</p>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div id="gameInfo">
        <p>You are {room.you}{opponent ? `, playing against ${opponent.name}` : ""}</p>
        <p>{status}</p>
        {notice && <p>{notice}</p>}
      </div>
      {room.status === "over" &&
        (room.rematch.includes(room.you) ? (
          <p>Waiting for {opponent?.name} to accept the rematch…</p>
        ) : (
          <button onClick={() => send({ type: "rematch" })}>Rematch</button>
        ))}
      <button onClick={leave}>Leave</button>
    </>
  );
}
