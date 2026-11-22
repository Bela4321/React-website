import { useState } from "react";
import { createRoot } from "react-dom/client";
import TicTacToeGame from "./pages/TicTacToeGame";
import "./apps.css";

const ROOM = /^[a-z0-9-]{1,32}$/;

function load(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: nothing to keep */
  }
}

function TicTacToeApp() {
  const [name, setName] = useState(() => load("ttt-name", ""));
  const [room, setRoom] = useState(() => String(Math.floor(100 + Math.random() * 900)));
  const [errors, setErrors] = useState<{ name?: string; room?: string }>({});
  const [playing, setPlaying] = useState<{ name: string; room: string } | null>(null);

  if (playing) {
    return <TicTacToeGame nickname={playing.name} roomNumber={playing.room} onLeave={() => setPlaying(null)} />;
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    const r = room.trim().toLowerCase();
    const next: typeof errors = {};
    if (!n) next.name = "Write the name your friend will see.";
    if (!ROOM.test(r)) next.room = "Use letters, digits or dashes, up to 32 characters.";
    setErrors(next);
    if (next.name || next.room) return;
    save("ttt-name", n);
    setPlaying({ name: n, room: r });
  };

  return (
    <form className="join" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="t-name">Your name</label>
        <input id="t-name" type="text" autoComplete="nickname" maxLength={24} value={name}
          aria-invalid={errors.name ? true : undefined} aria-describedby="t-name-err"
          onChange={(e) => setName(e.target.value)} />
        <p className="field__error" id="t-name-err" hidden={!errors.name}>{errors.name}</p>
      </div>
      <div className="field">
        <label htmlFor="t-room">Room</label>
        <input id="t-room" type="text" autoComplete="off" autoCapitalize="none" maxLength={32} value={room}
          aria-invalid={errors.room ? true : undefined} aria-describedby="t-room-err"
          onChange={(e) => setRoom(e.target.value)} />
        <p className="field__error" id="t-room-err" hidden={!errors.room}>{errors.room}</p>
      </div>
      <div className="btn-row">
        <button className="btn btn--primary" type="submit">Join the room</button>
      </div>
    </form>
  );
}

createRoot(document.getElementById("app")!).render(<TicTacToeApp />);
