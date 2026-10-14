import { useEffect, useMemo, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import { generateExpedition, type Clue } from "./data";
import styles from "./Cartographer.module.css";

interface Point {
  x: number;
  y: number;
}

const MOUTH_Y = 68;

export function Cartographer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [expedition, setExpedition] = useState(1);
  const data = useMemo(() => generateExpedition(expedition), [expedition]);
  const [clueIndex, setClueIndex] = useState(0);
  const [placements, setPlacements] = useState<Record<number, Point>>({});
  const [rejectFlash, setRejectFlash] = useState<Point | null>(null);

  const clue: Clue | undefined = data.clues[clueIndex];
  const finished = clueIndex >= data.clues.length - 1 && clue?.kind === "unknown";
  const placedForCurrent = clue ? !clue.manual || placements[clueIndex] !== undefined : true;

  const coastlineX = findPlacement("coastline");
  const mountainPos = findPlacement("mountain");
  const lakePos = findPlacement("lake");
  const riverWaypoint = findPlacement("river");
  const forestPos = findPlacement("forest");
  const hillsPos = findPlacement("hills");
  const settlementPos = findPlacement("settlement");
  const secondSettlementPos = findPlacement("second-settlement");

  function findPlacement(kind: Clue["kind"]): Point | null {
    const idx = data.clues.findIndex((c) => c.kind === kind);
    if (idx === -1) return null;
    return placements[idx] ?? null;
  }

  const mouthPoint: Point | null = coastlineX !== null ? { x: coastlineX.x, y: MOUTH_Y } : null;

  /**
   * The river isn't straight — it's a curve through mountain, the
   * player's waypoint, and the mouth. "West of the river" only means
   * something relative to where the river actually is at that same
   * height, so this walks the curve to find the closest point to `y`.
   */
  function riverXAtY(y: number): number | null {
    if (!mountainPos || !riverWaypoint || !mouthPoint) return null;
    let bestX = riverWaypoint.x;
    let bestDist = Infinity;
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const mt = 1 - t;
      const bx = mt * mt * mountainPos.x + 2 * mt * t * riverWaypoint.x + t * t * mouthPoint.x;
      const by = mt * mt * mountainPos.y + 2 * mt * t * riverWaypoint.y + t * t * mouthPoint.y;
      const d = Math.abs(by - y);
      if (d < bestDist) {
        bestDist = d;
        bestX = bx;
      }
    }
    return bestX;
  }

  /** Whether a click at (x, y) satisfies the current clue, given what's already on the map. */
  function validate(x: number, y: number): boolean {
    if (!clue) return false;
    switch (clue.kind) {
      case "coastline":
        return x >= data.coastlineRange[0] - 6 && x <= data.coastlineRange[1] + 4;
      case "mountain": {
        const r = data.mountainRegion;
        return x >= r.minX - 3 && x <= r.maxX + 3 && y >= r.minY - 3 && y <= r.maxY + 3;
      }
      case "lake": {
        if (!mountainPos) return false;
        const dx = x - mountainPos.x;
        const dy = y - (mountainPos.y + 18);
        return Math.hypot(dx, dy) < 16;
      }
      case "river": {
        if (!mountainPos || !mouthPoint) return false;
        const minX = Math.min(mountainPos.x, mouthPoint.x) - 12;
        const maxX = Math.max(mountainPos.x, mouthPoint.x) + 12;
        const minY = Math.min(mountainPos.y, mouthPoint.y) - 6;
        const maxY = Math.max(mountainPos.y, mouthPoint.y) + 6;
        return x >= minX && x <= maxX && y >= minY && y <= maxY;
      }
      case "forest": {
        if (!riverWaypoint) return false;
        const riverX = riverXAtY(y) ?? riverWaypoint.x;
        const margin = 4;
        const onSide = data.forestSide === "west" ? x < riverX - margin : x > riverX + margin;
        return onSide && y >= 15 && y <= 78;
      }
      case "hills": {
        const r = data.hillsRegion;
        return x >= r.minX - 3 && x <= r.maxX + 3 && y >= r.minY - 3 && y <= r.maxY + 3;
      }
      case "settlement": {
        if (!mouthPoint || !riverWaypoint) return false;
        if (data.settlementTarget === "mouth") {
          return Math.hypot(x - mouthPoint.x, y - mouthPoint.y) < 12;
        }
        const target = { x: riverWaypoint.x, y: riverWaypoint.y };
        return Math.hypot(x - target.x, y - target.y) < 16;
      }
      case "second-settlement": {
        if (!settlementPos || !coastlineX) return false;
        const dy = data.secondSettlementDir === "north" ? settlementPos.y - y : y - settlementPos.y;
        return Math.abs(x - coastlineX.x) < 10 && dy > 16 && y >= 6 && y <= 92;
      }
      default:
        return false;
    }
  }

  useEffect(() => {
    const canvasRaw = canvasRef.current;
    if (!canvasRaw) return;
    const canvas = canvasRaw as HTMLCanvasElement;
    const ctxRaw = canvas.getContext("2d");
    if (!ctxRaw) return;
    const ctx = ctxRaw as CanvasRenderingContext2D;

    let width = 0;
    let height = 0;
    let raf = 0;

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function px(p: Point) {
      return { x: (p.x / 100) * width, y: (p.y / 100) * height };
    }

    function draw() {
      ctx.fillStyle = "#d9d6c9";
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = "rgba(38,55,71,0.05)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(0, (i / 6) * height);
        ctx.lineTo(width, (i / 6) * height + 10);
        ctx.stroke();
      }

      if (coastlineX !== null) {
        const cx = (coastlineX.x / 100) * width;
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        for (let y = 0; y <= height; y += 8) ctx.lineTo(cx + Math.sin(y / 26) * 8, y);
        ctx.lineTo(width, height);
        ctx.lineTo(width, 0);
        ctx.closePath();
        ctx.fillStyle = "#8fafbd";
        ctx.fill();
        ctx.strokeStyle = "#263747";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        for (let y = 0; y <= height; y += 8) ctx.lineTo(cx + Math.sin(y / 26) * 8, y);
        ctx.stroke();
      }

      if (lakePos) {
        const p = px(lakePos);
        ctx.fillStyle = "#8fafbd";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 16, 11, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#263747";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (mountainPos) {
        const p = px(mountainPos);
        ctx.fillStyle = "#9b765b";
        for (const [dx, s] of [[-14, 22], [8, 30], [-2, 26]] as [number, number][]) {
          ctx.beginPath();
          ctx.moveTo(p.x + dx, p.y);
          ctx.lineTo(p.x + dx - s * 0.5, p.y + s);
          ctx.lineTo(p.x + dx + s * 0.5, p.y + s);
          ctx.closePath();
          ctx.fill();
        }
      }

      if (mountainPos && mouthPoint && riverWaypoint) {
        const m = px(mountainPos);
        const wp = px(riverWaypoint);
        const e = px(mouthPoint);
        ctx.strokeStyle = "#8fafbd";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y + 20);
        ctx.quadraticCurveTo(wp.x, wp.y, e.x, e.y);
        ctx.stroke();
      }

      if (forestPos) {
        const p = px(forestPos);
        ctx.fillStyle = "#799b6e";
        for (const [dx, dy] of [[0, 0], [-10, 6], [10, 4], [-4, -10], [8, -8]] as [number, number][]) {
          ctx.beginPath();
          ctx.arc(p.x + dx, p.y + dy, 9, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (hillsPos) {
        const p = px(hillsPos);
        ctx.fillStyle = "rgba(154,127,96,0.75)";
        for (const [dx, s] of [[-16, 12], [0, 16], [16, 12]] as [number, number][]) {
          ctx.beginPath();
          ctx.ellipse(p.x + dx, p.y, s, s * 0.55, 0, Math.PI, 0);
          ctx.fill();
        }
      }

      function drawSettlement(pos: Point) {
        const p = px(pos);
        ctx.fillStyle = "#b85a57";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#263747";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 4);
        ctx.lineTo(p.x, p.y - 14);
        ctx.moveTo(p.x, p.y - 14);
        ctx.lineTo(p.x + 8, p.y - 11);
        ctx.lineTo(p.x, p.y - 8);
        ctx.stroke();
      }

      if (settlementPos) drawSettlement(settlementPos);
      if (secondSettlementPos) drawSettlement(secondSettlementPos);

      if (finished) {
        const fog = ctx.createLinearGradient(0, 0, width * 0.35, 0);
        fog.addColorStop(0, "rgba(217,214,201,0.97)");
        fog.addColorStop(1, "rgba(217,214,201,0)");
        ctx.fillStyle = fog;
        ctx.fillRect(0, 0, width * 0.35, height);
        ctx.fillStyle = "rgba(38,55,71,0.5)";
        ctx.font = '12px "IBM Plex Mono", "SFMono-Regular", monospace';
        ctx.save();
        ctx.translate(width * 0.1, height * 0.5);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText("UNCHARTED", 0, 0);
        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    }

    function onClick(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      const currentClue = data.clues[clueIndex];
      if (!currentClue || !currentClue.manual || placements[clueIndex] !== undefined) return;
      if (validate(x, y)) {
        setPlacements((prev) => ({ ...prev, [clueIndex]: { x, y } }));
        setRejectFlash(null);
      } else {
        setRejectFlash({ x, y });
        window.setTimeout(() => setRejectFlash(null), 500);
      }
    }

    resize();
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    canvas.addEventListener("click", onClick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("click", onClick);
    };
    // Re-bind whenever any placement, the active clue, or the expedition changes,
    // since the click handler and drawing both depend on all of them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placements, clueIndex, data, finished]);

  function nextClue() {
    setClueIndex((i) => Math.min(data.clues.length - 1, i + 1));
  }

  function newExpedition() {
    setExpedition((e) => e + 1);
    setClueIndex(0);
    setPlacements({});
    setRejectFlash(null);
  }

  if (!clue) return null;

  return (
    <ExperienceLayout title="The Cartographer" category="History & Culture" accent="#8fafbd" background="#d9d6c9" light>
      <div className={styles.stage}>
        <div className={styles.expeditionLabel}>Expedition {expedition}</div>

        <div className={styles.mapFrame}>
          <canvas ref={canvasRef} className={styles.canvas} />
          {rejectFlash && (
            <div
              className={styles.rejectMark}
              style={{ left: `${rejectFlash.x}%`, top: `${rejectFlash.y}%` }}
            />
          )}
        </div>

        <div className={styles.reportBox}>
          <div className={styles.reportEyebrow}>Report {clueIndex + 1} of {data.clues.length}</div>
          <p className={styles.reportText}>{clue.text}</p>
          {clue.manual && !placedForCurrent && (
            <p className={styles.prompt}>
              {rejectFlash ? "That doesn't match the report — look again." : "Click the map to place it."}
            </p>
          )}
        </div>

        {!finished ? (
          <button type="button" className={styles.nextButton} onClick={nextClue} disabled={!placedForCurrent}>
            Next report {"\u2192"}
          </button>
        ) : (
          <div className={styles.donePanel}>
            <button type="button" className={styles.nextButton} onClick={newExpedition}>
              A new expedition {"\u2192"}
            </button>
          </div>
        )}
      </div>
    </ExperienceLayout>
  );
}
