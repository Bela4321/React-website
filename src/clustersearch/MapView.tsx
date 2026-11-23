import { useEffect, useMemo, useRef, useState } from "react";
import type { Paper } from "./api.ts";
import type { Analysis } from "./analysis.ts";
import { colorOf, NOISE_COLOR, sourceNames } from "./ui.ts";

type View = { k: number; x: number; y: number }; // screen = data * size * k + (x, y)

const PAD = 28;
const HIT = 11; // px around the pointer that count as "on" a point

/**
 * The 2D map: every paper a dot (bigger = closer to the question), coloured by its cluster.
 * Wheel or pinch to zoom, drag to pan. Hovering shows the papers under the pointer (several
 * when dots overlap at this zoom level); clicking opens one paper, or pins the list.
 */
export default function MapView({
  papers,
  analysis,
  shown,
  labels,
  nameOf,
}: {
  papers: Paper[];
  analysis: Analysis;
  shown: number[];
  labels: number[];
  nameOf: (id: number) => string | undefined;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 560 });
  const [view, setView] = useState<View>({ k: 1, x: 0, y: 0 });
  const [hover, setHover] = useState<{ x: number; y: number; ids: number[] } | null>(null);
  const [pinned, setPinned] = useState<{ x: number; y: number; ids: number[] } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  useEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: Math.max(360, Math.min(620, el.clientWidth * 0.7)) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // a new result starts zoomed out
  useEffect(() => {
    setView({ k: 1, x: 0, y: 0 });
    setPinned(null);
  }, [analysis]);

  const base = useMemo(
    () => analysis.coords.map(([x, y]) => [PAD + x * (size.w - 2 * PAD), PAD + y * (size.h - 2 * PAD)] as const),
    [analysis, size],
  );
  const screen = (i: number) => [base[i][0] * view.k + view.x, base[i][1] * view.k + view.y] as const;

  const near = (sx: number, sy: number) =>
    papers
      .map((_, i) => {
        const [px, py] = screen(i);
        return { i, d: Math.hypot(px - sx, py - sy) };
      })
      .filter((p) => p.d <= HIT)
      .sort((a, b) => a.d - b.d)
      .map((p) => p.i);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const zoomAt = (sx: number, sy: number, factor: number) =>
    setView((v) => {
      const k = Math.min(40, Math.max(1, v.k * factor));
      const f = k / v.k;
      return k === 1 ? { k: 1, x: 0, y: 0 } : { k, x: sx - (sx - v.x) * f, y: sy - (sy - v.y) * f };
    });

  // wheel zoom needs a non-passive listener to stop the page from scrolling
  useEffect(() => {
    const el = box.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = local(e);
      zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    drag.current = { ...p, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = local(e);
    const ps = pointers.current;
    if (ps.has(e.pointerId)) {
      const prev = ps.get(e.pointerId)!;
      if (ps.size === 2) {
        // pinch: zoom by the change in finger distance, around their midpoint
        const other = [...ps.entries()].find(([id]) => id !== e.pointerId)![1];
        const before = Math.hypot(prev.x - other.x, prev.y - other.y);
        const after = Math.hypot(p.x - other.x, p.y - other.y);
        if (before > 0) zoomAt((p.x + other.x) / 2, (p.y + other.y) / 2, after / before);
      } else if (drag.current) {
        const dx = p.x - prev.x;
        const dy = p.y - prev.y;
        if (Math.abs(p.x - drag.current.x) + Math.abs(p.y - drag.current.y) > 4) drag.current.moved = true;
        setView((v) => (v.k === 1 ? v : { ...v, x: v.x + dx, y: v.y + dy }));
      }
      ps.set(e.pointerId, p);
      setHover(null);
      return;
    }
    const ids = near(p.x, p.y);
    setHover(ids.length ? { ...p, ids } : null);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const p = local(e);
    const wasDrag = drag.current?.moved;
    pointers.current.delete(e.pointerId);
    drag.current = null;
    if (wasDrag) return;
    const ids = near(p.x, p.y);
    if (ids.length === 1 && e.pointerType === "mouse") window.open(papers[ids[0]].url, "_blank", "noopener");
    else setPinned(ids.length ? { ...p, ids } : null);
  };

  // cluster labels at the middle of each cluster
  const centres = shown.map((id, ci) => {
    const pts = labels.map((l, i) => (l === id ? i : -1)).filter((i) => i >= 0);
    const cx = pts.reduce((s, i) => s + screen(i)[0], 0) / (pts.length || 1);
    const cy = pts.reduce((s, i) => s + screen(i)[1], 0) / (pts.length || 1);
    return { id, ci, cx, cy, n: pts.length };
  });

  const popup = pinned ?? hover;
  const order = papers.map((_, i) => i).sort((a, b) => analysis.relevance[a] - analysis.relevance[b]);

  return (
    <div className="grid gap-3">
      <div
        ref={box}
        className="relative touch-none overflow-hidden rounded-3xl bg-white ring-1 ring-plum/15 select-none"
        style={{ height: size.h, cursor: view.k > 1 ? "grab" : "default" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHover(null)}
      >
        <svg width={size.w} height={size.h} className="block">
          {order.map((i) => {
            const [x, y] = screen(i);
            if (x < -10 || y < -10 || x > size.w + 10 || y > size.h + 10) return null;
            const ci = shown.indexOf(labels[i]);
            const r = 3.5 + analysis.relevance[i] * 4.5;
            const active = popup?.ids.includes(i);
            return (
              <circle
                key={papers[i].id}
                cx={x}
                cy={y}
                r={active ? r + 2 : r}
                fill={ci >= 0 ? colorOf(ci) : NOISE_COLOR}
                fillOpacity={ci >= 0 ? 0.85 : 0.6}
                stroke={active ? "#1d1829" : "white"}
                strokeWidth={active ? 1.5 : 1}
              />
            );
          })}
          {centres.map(
            (c) =>
              c.n > 0 && (
                <text
                  key={c.id}
                  x={Math.min(size.w - 90, Math.max(90, c.cx))}
                  y={c.cy - 12}
                  textAnchor="middle"
                  className="pointer-events-none text-[12px] font-semibold"
                  fill={colorOf(c.ci)}
                  stroke="white"
                  strokeWidth={4}
                  paintOrder="stroke"
                >
                  {nameOf(c.id) ?? analysis.keywords(c.id).slice(0, 2).join(" · ")}
                </text>
              ),
          )}
        </svg>

        {popup && (
          <div
            className={`absolute z-10 w-72 max-w-[85%] rounded-2xl bg-white p-3 text-sm shadow-xl ring-1 ring-plum/15 ${pinned ? "" : "pointer-events-none"}`}
            style={{
              left: Math.min(popup.x + 14, size.w - 290),
              top: popup.y + 14 > size.h - 180 ? Math.max(8, popup.y - 190) : popup.y + 14,
            }}
          >
            {popup.ids.length > 1 && <p className="mb-1 text-xs text-muted">{popup.ids.length} papers here</p>}
            <ul className="grid max-h-44 gap-2 overflow-y-auto">
              {popup.ids.slice(0, pinned ? 20 : 4).map((i) => (
                <li key={papers[i].id}>
                  <a href={papers[i].url} target="_blank" rel="noopener" className="font-medium text-ink hover:text-plum hover:underline">
                    {papers[i].title}
                  </a>
                  <p className="text-xs text-muted">
                    {papers[i].year ?? ""} · {papers[i].sources.map((s) => sourceNames[s]).join(", ")}
                  </p>
                </li>
              ))}
            </ul>
            {!pinned && popup.ids.length > 4 && <p className="mt-1 text-xs text-muted">and {popup.ids.length - 4} more: click to list them</p>}
            {pinned && (
              <button type="button" className="mt-2 text-xs font-medium text-plum" onClick={() => setPinned(null)}>
                Close
              </button>
            )}
          </div>
        )}

        <div className="absolute right-3 bottom-3 flex gap-1.5">
          <button type="button" aria-label="Zoom in" className="map-btn" onPointerDown={(e) => e.stopPropagation()} onClick={() => zoomAt(size.w / 2, size.h / 2, 1.6)}>+</button>
          <button type="button" aria-label="Zoom out" className="map-btn" onPointerDown={(e) => e.stopPropagation()} onClick={() => zoomAt(size.w / 2, size.h / 2, 1 / 1.6)}>−</button>
          {view.k > 1 && (
            <button type="button" className="map-btn w-auto px-3 text-xs" onPointerDown={(e) => e.stopPropagation()} onClick={() => setView({ k: 1, x: 0, y: 0 })}>
              Reset
            </button>
          )}
        </div>
      </div>
      <p className="text-sm text-muted">
        Each dot is a paper; similar papers sit close together. Bigger dots match your search better; grey ones belong to no cluster.
        Scroll or pinch to zoom, drag to move, click a dot to open the paper.
      </p>
    </div>
  );
}
