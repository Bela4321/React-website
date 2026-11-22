import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import TicTacToeGame, { GAMES_HTTP } from "./pages/TicTacToeGame";
import { pickName } from "./lib/names";
import "./styles.css";

const ROOM = /^[a-z0-9-]{1,32}$/;

type OpenRoom = { room: string; host: string };
type Lobby = { open: OpenRoom[]; names: string[] };
type Playing = { name: string; room: string; isPublic: boolean };

function load(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}
function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: nothing to keep */
  }
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(GAMES_HTTP + path, { cache: "no-store" });
  if (!res.ok) throw new Error(String(res.status));
  return res.json() as Promise<T>;
}

/** The lobby, refreshed every few seconds while the join screen is open. */
function useLobby(active: boolean): Lobby | null {
  const [lobby, setLobby] = useState<Lobby | null>(null);
  useEffect(() => {
    if (!active) return;
    let stop = false;
    const tick = () =>
      getJson<Lobby>("/lobby")
        .then((l) => !stop && setLobby(l))
        .catch(() => {});
    tick();
    const t = setInterval(tick, 4000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [active]);
  return lobby;
}

/** Whether a room is in use, checked as the visitor types its name. */
function useRoomExists(room: string): boolean | null {
  const [exists, setExists] = useState<boolean | null>(null);
  useEffect(() => {
    if (!ROOM.test(room)) return setExists(null);
    let stop = false;
    const t = setTimeout(() => {
      getJson<{ exists: boolean }>(`/lobby/rooms/${encodeURIComponent(room)}`)
        .then((r) => !stop && setExists(r.exists))
        .catch(() => !stop && setExists(null));
    }, 250);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [room]);
  return exists;
}

function TicTacToeApp() {
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [name, setName] = useState(() => load("ttt-name"));
  const [room, setRoom] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const lobby = useLobby(!playing);
  const roomId = room.trim().toLowerCase();
  const exists = useRoomExists(roomId);
  const creating = !roomId || exists === false;
  // a suggested name nobody in the lobby is using; kept stable while it stays free
  const suggestion = useMemo(() => pickName(lobby?.names ?? []), [lobby?.names.join("|")]);

  if (playing) {
    return (
      <TicTacToeGame
        nickname={playing.name}
        roomNumber={playing.room}
        isPublic={playing.isPublic}
        onLeave={() => setPlaying(null)}
      />
    );
  }

  const start = async (targetRoom: string, publicRoom: boolean) => {
    const n = name.trim() || suggestion;
    if (name.trim()) save("ttt-name", name.trim());
    setError("");
    setBusy(true);
    try {
      let id = targetRoom;
      if (!id) {
        // a free three-digit room; any number if the lobby can't be reached
        id = await getJson<{ room: string }>("/lobby/free-room")
          .then((r) => r.room)
          .catch(() => String(100 + Math.floor(Math.random() * 900)));
      }
      setPlaying({ name: n, room: id, isPublic: publicRoom });
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId && !ROOM.test(roomId)) {
      setError("Room names use letters, digits or dashes, up to 32 characters.");
      return;
    }
    start(roomId, creating && isPublic);
  };

  const open = lobby?.open ?? [];

  return (
    <div className="grid max-w-2xl gap-10">
      {open.length > 0 && (
        <section aria-labelledby="open-h">
          <h2 id="open-h" className="text-xl font-medium">Open rooms</h2>
          <p className="mt-1 text-muted">Someone is waiting for a second player.</p>
          <ul className="-mx-5 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-3 sm:mx-0 sm:px-0">
            {open.map((o) => (
              <li key={o.room} className="shrink-0 snap-start">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => start(o.room, false)}
                  className="group grid w-44 gap-1 rounded-2xl bg-lilac p-4 text-left ring-1 ring-plum/10 transition hover:-translate-y-0.5 hover:bg-lilac-deep"
                >
                  <span className="text-sm text-muted">Room {o.room}</span>
                  <span className="truncate font-medium">{o.host}</span>
                  <span className="mt-2 text-sm font-medium text-plum">
                    Join <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-1">→</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form onSubmit={submit} noValidate className="grid gap-5 sm:max-w-md">
        <label className="field">
          Your name
          <input
            className="input"
            type="text"
            autoComplete="nickname"
            maxLength={24}
            value={name}
            placeholder={suggestion}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="field">
          Room
          <input
            className="input"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            inputMode="numeric"
            maxLength={32}
            value={room}
            placeholder="Leave empty for a new room"
            aria-invalid={error ? true : undefined}
            onChange={(e) => {
              setRoom(e.target.value);
              setError("");
            }}
          />
          {error && <span className="font-normal text-red-700">{error}</span>}
        </label>

        {creating && (
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Who can find the room</legend>
            <div className="inline-grid grid-cols-2 rounded-xl bg-lilac p-1">
              {[
                { v: false, label: "Private" },
                { v: true, label: "Public" },
              ].map((o) => (
                <label
                  key={o.label}
                  className={`cursor-pointer rounded-lg px-4 py-2 text-center font-medium transition ${
                    isPublic === o.v ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
                  }`}
                >
                  <input type="radio" name="visibility" className="sr-only" checked={isPublic === o.v} onChange={() => setIsPublic(o.v)} />
                  {o.label}
                </label>
              ))}
            </div>
            <p className="text-sm text-muted">
              {isPublic ? "Listed in open rooms until a second player joins." : "Only people you send the number to can join."}
            </p>
          </fieldset>
        )}

        <button className="btn-primary justify-self-start" type="submit" disabled={busy}>
          {creating ? "Create the room" : "Join the room"}
        </button>
      </form>
    </div>
  );
}

createRoot(document.getElementById("app")!).render(<TicTacToeApp />);
