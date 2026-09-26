import { useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import styles from "./Paper.module.css";

const FOLD_LINES = [
  "A flat, unremarkable rectangle.",
  "One crease. It remembers this now.",
  "Getting harder to flatten back out.",
  "Small, and getting stubborn about staying that way.",
  "Folded in more than one direction now.",
  "About as small as this sheet is going to get.",
];

const CRUMPLE_LINES = [
  "Every crumple is a little different from the last.",
  "It won't sit flat again on its own.",
  "Somewhere between a ball and a decision.",
  "The wrinkles catch the light differently now.",
];

const TEAR_LINES = [
  "There's nothing hidden inside. It's paper.",
  "Two pieces now, for better or worse.",
  "A third piece. Whatever this was, it isn't anymore.",
  "In pieces — that's about as far as this can go.",
];

const FLATTEN_LINES = [
  "Better. Not perfect — paper remembers.",
  "Smoothed out, though the creases still show.",
  "As flat as a used sheet gets.",
];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

// A deterministic jagged edge — sine-based, not random, so a tear of a
// given width always looks the same shape.
function tearOffsets(height: number, amplitude: number): [number, number][] {
  const steps = 12;
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const y = (i / steps) * height;
    const x = Math.sin(i * 1.7) * amplitude + Math.sin(i * 4.1) * amplitude * 0.35;
    points.push([x, y]);
  }
  return points;
}

function piecePolygon(width: number, height: number, leftJagged: boolean, rightJagged: boolean): string {
  const amplitude = Math.min(8, width * 0.14);
  const offsets = tearOffsets(height, amplitude);
  const pts: [number, number][] = [[0, 0], [width, 0]];
  if (rightJagged) {
    for (const [dx, y] of offsets) pts.push([width + dx, y]);
  }
  pts.push([width, height]);
  pts.push([0, height]);
  if (leftJagged) {
    for (let i = offsets.length - 1; i >= 0; i--) {
      const [dx, y] = offsets[i];
      pts.push([dx, y]);
    }
  }
  return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

const PAPER_W = 210;
const PAPER_H = 290;
const MAX_FOLD_V = 3;
const MAX_FOLD_H = 2;
const MAX_CRUMPLE = 3;
const MAX_TEARS = 3; // up to 4 pieces

export function Paper() {
  const [foldV, setFoldV] = useState(0);
  const [foldH, setFoldH] = useState(0);
  const [everFoldV, setEverFoldV] = useState(0);
  const [everFoldH, setEverFoldH] = useState(0);
  const [crumpleLevel, setCrumpleLevel] = useState(0);
  const [everCrumpled, setEverCrumpled] = useState(0);
  const [tearCount, setTearCount] = useState(0);
  const [jitter, setJitter] = useState(0);
  const [turbulenceSeed, setTurbulenceSeed] = useState(2);
  const [caption, setCaption] = useState("Fold it. Crumple it. Tear it. See what it does.");

  const torn = tearCount > 0;

  function foldVertical() {
    if (torn || foldV >= MAX_FOLD_V) return;
    const next = foldV + 1;
    setFoldV(next);
    setEverFoldV((e) => Math.max(e, next));
    setCaption(FOLD_LINES[Math.min(FOLD_LINES.length - 1, next + foldH)]);
  }

  function foldHorizontal() {
    if (torn || foldH >= MAX_FOLD_H) return;
    const next = foldH + 1;
    setFoldH(next);
    setEverFoldH((e) => Math.max(e, next));
    setCaption(FOLD_LINES[Math.min(FOLD_LINES.length - 1, foldV + next)]);
  }

  function crumple() {
    if (torn || crumpleLevel >= MAX_CRUMPLE) return;
    const next = crumpleLevel + 1;
    setCrumpleLevel(next);
    setEverCrumpled((e) => Math.max(e, next));
    setJitter((Math.random() - 0.5) * 14);
    setTurbulenceSeed(Math.floor(Math.random() * 100));
    setCaption(pick(CRUMPLE_LINES));
  }

  function tear() {
    if (tearCount >= MAX_TEARS) return;
    setTearCount((c) => c + 1);
    setCaption(TEAR_LINES[Math.min(TEAR_LINES.length - 1, tearCount)]);
  }

  function flatten() {
    if (foldV === 0 && foldH === 0 && crumpleLevel === 0) return;
    setFoldV(0);
    setFoldH(0);
    setCrumpleLevel(0);
    setJitter(0);
    setCaption(pick(FLATTEN_LINES));
  }

  function newSheet() {
    setFoldV(0);
    setFoldH(0);
    setEverFoldV(0);
    setEverFoldH(0);
    setCrumpleLevel(0);
    setEverCrumpled(0);
    setTearCount(0);
    setJitter(0);
    setCaption("A fresh sheet. Fold it. Crumple it. Tear it. See what it does.");
  }

  const foldScaleV = 1 - foldV * 0.15;
  const foldScaleH = 1 - foldH * 0.18;
  const crumpleShrink = 1 - crumpleLevel * 0.05;
  // A crumple leaves a faint permanent texture even once "flattened."
  const displacement = crumpleLevel > 0 ? crumpleLevel * 7 : Math.min(everCrumpled, MAX_CRUMPLE) * 2;

  const width = PAPER_W * foldScaleV * crumpleShrink;
  const height = PAPER_H * foldScaleH * crumpleShrink;

  const vCreaseCount = foldV > 0 ? foldV : everFoldV;
  const vCreaseGhost = foldV === 0 && everFoldV > 0;
  const hCreaseCount = foldH > 0 ? foldH : everFoldH;
  const hCreaseGhost = foldH === 0 && everFoldH > 0;

  const pieces = tearCount + 1;
  const pieceWidth = width / pieces;
  const totalPieceWidth = pieceWidth * pieces + (pieces - 1) * 6;

  return (
    <ExperienceLayout title="Paper" category="Interactive Art" accent="#C7D1DF" background="#14161c">
      <div className={styles.stage}>
        <div className={styles.sheetArea}>
          <svg viewBox="0 0 320 400" className={styles.svg}>
            <defs>
              <filter id="paper-crumple" x="-40%" y="-40%" width="180%" height="180%">
                <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves={2} seed={turbulenceSeed} result="noise" />
                <feDisplacementMap in="SourceGraphic" in2="noise" scale={displacement} />
              </filter>
            </defs>

            {!torn && (
              <g
                transform={`translate(160,200) rotate(${jitter}) translate(${-width / 2},${-height / 2})`}
                filter={displacement > 0 ? "url(#paper-crumple)" : undefined}
              >
                <rect width={width} height={height} rx={4} fill="#e7eaf0" />
                {vCreaseCount > 0 &&
                  Array.from({ length: vCreaseCount }).map((_, i) => {
                    const x = (width / (vCreaseCount + 1)) * (i + 1);
                    return (
                      <line
                        key={`v${i}`}
                        x1={x} y1={4} x2={x} y2={height - 4}
                        stroke="#9aa4b4" strokeWidth={1.2} opacity={vCreaseGhost ? 0.22 : 0.6}
                      />
                    );
                  })}
                {hCreaseCount > 0 &&
                  Array.from({ length: hCreaseCount }).map((_, i) => {
                    const y = (height / (hCreaseCount + 1)) * (i + 1);
                    return (
                      <line
                        key={`h${i}`}
                        x1={4} y1={y} x2={width - 4} y2={y}
                        stroke="#9aa4b4" strokeWidth={1.2} opacity={hCreaseGhost ? 0.22 : 0.6}
                      />
                    );
                  })}
              </g>
            )}

            {torn && (
              <g filter={displacement > 0 ? "url(#paper-crumple)" : undefined}>
                {Array.from({ length: pieces }).map((_, i) => {
                  const centerOffset = i - (pieces - 1) / 2;
                  const rotation = centerOffset * 5;
                  const startX = 160 - totalPieceWidth / 2 + i * (pieceWidth + 6);
                  const startY = 200 - height / 2 + Math.abs(centerOffset) * 4;
                  const shade = i % 2 === 0 ? "#e7eaf0" : "#dde1e8";
                  return (
                    <g key={i} transform={`translate(${startX},${startY}) rotate(${rotation})`}>
                      <polygon
                        points={piecePolygon(pieceWidth, height, i > 0, i < pieces - 1)}
                        fill={shade}
                      />
                    </g>
                  );
                })}
              </g>
            )}
          </svg>
        </div>

        <p className={styles.caption}>{caption}</p>

        <div className={styles.controls}>
          <button type="button" className={styles.button} onClick={foldVertical} disabled={torn || foldV >= MAX_FOLD_V}>
            Fold
          </button>
          <button type="button" className={styles.button} onClick={foldHorizontal} disabled={torn || foldH >= MAX_FOLD_H}>
            Fold across
          </button>
          <button type="button" className={styles.button} onClick={crumple} disabled={torn || crumpleLevel >= MAX_CRUMPLE}>
            Crumple
          </button>
          <button type="button" className={styles.button} onClick={tear} disabled={tearCount >= MAX_TEARS}>
            Tear
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={flatten}
            disabled={foldV === 0 && foldH === 0 && crumpleLevel === 0}
          >
            Flatten
          </button>
          <button type="button" className={styles.buttonGhost} onClick={newSheet}>
            New sheet
          </button>
        </div>
      </div>
    </ExperienceLayout>
  );
}
