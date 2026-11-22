import React, { useEffect, useRef, useState } from "react";

// Game server: a Cloudflare Worker (repo website-games). One room per name,
// two players, the server sends the full state after every change.
const SERVER: string =
  import.meta.env.VITE_GAMES_URL ?? "wss://games.belaschinke.com";
/** the same server over plain HTTP, for the lobby */
export const GAMES_HTTP = SERVER.replace(/^ws/, "http");

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
  /** list the room in the lobby while waiting (only counts when the room is new) */
  isPublic?: boolean;
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

export default function TicTacToeGame({ nickname, roomNumber, isPublic = false, onLeave }: Props) {
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
        `?name=${encodeURIComponent(nickname)}&pid=${pid}${isPublic ? "&public=1" : ""}`;
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
  }, [nickname, roomNumber, isPublic]);

  const send = (msg: object) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(msg));
  };
  const leave = onLeave;

  if (!room) {
    return (
      <div className="grid justify-items-start gap-4">
        <p className="text-lg text-muted" role="status">{notice}</p>
        <button className="btn-quiet" type="button" onClick={leave}>Pick another room</button>
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
    <div className="grid gap-8 lg:grid-cols-[auto_1fr] lg:items-start lg:gap-12">
      <div className="grid aspect-square w-full max-w-[24rem] grid-cols-3 gap-2.5" role="group" aria-label="Board">
        {room.board.map((cell, i) => {
          const where = `Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}`;
          return cell === null ? (
            <button
              key={i}
              type="button"
              disabled={!myTurn}
              aria-label={`${where}, empty`}
              onClick={() => send({ type: "move", cell: i })}
              className="rounded-2xl bg-lilac transition enabled:cursor-pointer enabled:hover:bg-lilac-deep disabled:cursor-default"
            />
          ) : (
            <span
              key={i}
              role="img"
              aria-label={`${where}, ${cell}`}
              className={`grid place-items-center rounded-2xl font-serif text-[clamp(3.5rem,16vw,5.5rem)] leading-none transition-colors ${
                room.line?.includes(i) ? "bg-plum text-white" : cell === room.you ? "bg-lilac-deep text-plum" : "bg-lilac text-ink"
              }`}
            >
              {cell}
            </span>
          );
        })}
      </div>
      <div className="grid content-start gap-5 lg:max-w-sm">
        <div>
          <p className="text-2xl font-medium" role="status">{status}</p>
          <p className="mt-2 text-muted">
            Room {roomNumber}. You play <span className="font-medium text-plum">{room.you}</span>
            {opponent ? ` against ${opponent.name}` : ""}.
          </p>
          {notice && <p className="mt-2 text-red-700">{notice}</p>}
        </div>
        {room.status === "over" &&
          (room.rematch.includes(room.you) ? (
            <p className="text-muted">Waiting for {opponent?.name} to accept the rematch.</p>
          ) : (
            <button className="btn-primary" type="button" onClick={() => send({ type: "rematch" })}>Play a rematch</button>
          ))}
        <button className="btn-quiet" type="button" onClick={leave}>Leave the room</button>
      </div>
    </div>
  );
}
