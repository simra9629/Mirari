import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import { NODES, EDGES, GOODS, type Good } from "./data";
import styles from "./SilkRoad.module.css";

interface Caravan {
  fromId: string;
  toId: string;
  t: number;
  duration: number;
  good: Good;
  waveId: number;
}

function buildAdjacency() {
  const adj = new Map<string, string[]>();
  NODES.forEach((n) => adj.set(n.id, []));
  for (const [a, b] of EDGES) {
    adj.get(a)!.push(b);
    adj.get(b)!.push(a);
  }
  return adj;
}

export function SilkRoad() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [lastGood, setLastGood] = useState<Good | null>(null);
  const [shipments, setShipments] = useState(0);
  const reducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

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
    const adjacency = buildAdjacency();
    let caravans: Caravan[] = [];
    const wavesVisited = new Map<number, Set<string>>();
    const nodeGoods = new Map<string, Good[]>();
    const nodePulses = new Map<string, { color: string; t: number }>();
    let waveCounter = 0;
    let goodCursor = 0;

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function nodePos(id: string) {
      const n = NODES.find((n) => n.id === id)!;
      return { x: (n.x / 100) * width, y: (n.y / 100) * height };
    }

    function propagate(nodeId: string, waveId: number, good: Good) {
      const visited = wavesVisited.get(waveId)!;
      const neighbors = adjacency.get(nodeId) ?? [];
      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        const a = nodePos(nodeId);
        const b = nodePos(neighbor);
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        caravans.push({ fromId: nodeId, toId: neighbor, t: 0, duration: Math.max(0.6, dist / 90), good, waveId });
      }
    }

    function spawnWave(originId: string) {
      const waveId = waveCounter++;
      const good = GOODS[goodCursor++ % GOODS.length];
      wavesVisited.set(waveId, new Set([originId]));
      nodePulses.set(originId, { color: good.color, t: 1 });
      recordGood(originId, good);
      propagate(originId, waveId, good);
      setLastGood(good);
      setShipments((s) => s + 1);
    }

    function recordGood(nodeId: string, good: Good) {
      const list = nodeGoods.get(nodeId) ?? [];
      list.push(good);
      if (list.length > 5) list.shift();
      nodeGoods.set(nodeId, list);
    }

    function onClick(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (width / rect.width);
      const y = (e.clientY - rect.top) * (height / rect.height);
      let closest: string | null = null;
      let closestDist = 26;
      for (const n of NODES) {
        const p = nodePos(n.id);
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < closestDist) {
          closestDist = d;
          closest = n.id;
        }
      }
      if (closest) spawnWave(closest);
    }

    let last = performance.now();

    function draw(t: number) {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;

      ctx.fillStyle = "#12182a";
      ctx.fillRect(0, 0, width, height);

      // Edges.
      ctx.strokeStyle = "rgba(119, 124, 130, 0.35)";
      ctx.lineWidth = 1.4;
      for (const [a, b] of EDGES) {
        const pa = nodePos(a);
        const pb = nodePos(b);
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }

      // Caravans.
      caravans = caravans.filter((c) => c.t < 1);
      for (const c of caravans) {
        if (!reducedMotion.current) c.t = Math.min(1, c.t + dt / c.duration);
        else c.t = 1;
        const a = nodePos(c.fromId);
        const b = nodePos(c.toId);
        const x = a.x + (b.x - a.x) * c.t;
        const y = a.y + (b.y - a.y) * c.t;

        ctx.strokeStyle = `${c.good.color}55`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(x, y);
        ctx.stroke();

        ctx.fillStyle = c.good.color;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();

        if (c.t >= 1) {
          nodePulses.set(c.toId, { color: c.good.color, t: 1 });
          recordGood(c.toId, c.good);
          propagate(c.toId, c.waveId, c.good);
        }
      }

      // Nodes.
      for (const n of NODES) {
        const p = nodePos(n.id);
        const pulse = nodePulses.get(n.id);
        if (pulse && !reducedMotion.current) {
          pulse.t -= dt * 1.4;
          if (pulse.t <= 0) nodePulses.delete(n.id);
        }
        if (pulse) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 6 + (1 - pulse.t) * 16, 0, Math.PI * 2);
          ctx.strokeStyle = `${pulse.color}${Math.round(pulse.t * 100)
            .toString(16)
            .padStart(2, "0")}`;
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }

        ctx.fillStyle = "#c6a46f";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#e8e3d4";
        ctx.font = '11px "IBM Plex Mono", "SFMono-Regular", monospace';
        ctx.textAlign = "center";
        ctx.fillText(n.name, p.x, p.y - 12);

        const goods = nodeGoods.get(n.id) ?? [];
        goods.forEach((g, i) => {
          ctx.fillStyle = g.color;
          ctx.beginPath();
          ctx.arc(p.x - (goods.length - 1) * 4 + i * 8, p.y + 14, 2.6, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      raf = requestAnimationFrame(draw);
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
  }, []);

  return (
    <ExperienceLayout title="The Silk Road" category="History & Culture" accent="#d5ad52" background="#12182a">
      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} />

        <div className={styles.hud}>
          <p className={styles.hint}>
            Click any city to send a good outward. Watch it move through
            the whole network, city by city — this was never one road.
          </p>
          <div className={styles.readout}>
            {shipments} shipment{shipments === 1 ? "" : "s"} sent
            {lastGood && (
              <>
                {" "}· last: <span style={{ color: lastGood.color }}>{lastGood.name}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </ExperienceLayout>
  );
}
