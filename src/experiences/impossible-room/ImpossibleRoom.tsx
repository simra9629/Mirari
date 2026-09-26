import { useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import styles from "./ImpossibleRoom.module.css";

const VIEWS = ["North wall", "East wall", "South wall", "West wall"] as const;

interface AnomalyMeta {
  line: string;
  requires?: string;
}

const ANOMALY_META: Record<string, AnomalyMeta> = {
  frame: { line: "Something is floating near the ceiling. Only slightly. Only always." },
  mirror: { line: "The mirror is not showing this room. It hasn't, in fact, for a while." },
  stairs: { line: "Through the gap in the wall: stairs, going somewhere that isn't underneath this room." },
  crack: {
    line: "A crack has opened in the ceiling — it wasn't there before you found the mirror.",
    requires: "mirror",
  },
};

const DECOY_LINE = "Just a painting. Completely, disappointingly explicable.";

interface LevelConfig {
  required: string[];
  hasDecoy: boolean;
}

const LEVELS: LevelConfig[] = [
  { required: ["frame", "mirror", "stairs"], hasDecoy: false },
  { required: ["frame", "mirror", "stairs", "crack"], hasDecoy: false },
  { required: ["frame", "mirror", "stairs", "crack"], hasDecoy: true },
];

export function ImpossibleRoom() {
  const [level, setLevel] = useState(1);
  const [viewIndex, setViewIndex] = useState(0);
  const [found, setFound] = useState<Set<string>>(new Set());
  const [caption, setCaption] = useState("Turn to look around. Something here doesn't add up.");
  const [resolved, setResolved] = useState(false);

  const config = LEVELS[Math.min(level - 1, LEVELS.length - 1)];
  const allFound = config.required.every((id) => found.has(id));

  function isUnlocked(id: string): boolean {
    const req = ANOMALY_META[id]?.requires;
    return !req || found.has(req);
  }

  function turn(dir: 1 | -1) {
    setViewIndex((v) => (v + dir + 4) % 4);
  }

  function collect(id: string) {
    if (!config.required.includes(id) || found.has(id) || !isUnlocked(id)) return;
    setFound((prev) => new Set(prev).add(id));
    setCaption(ANOMALY_META[id].line);
  }

  function clickDecoy() {
    setCaption(DECOY_LINE);
  }

  function openDoor() {
    setResolved(true);
    setCaption("The door leads back into the room. It was always going to.");
  }

  function nextCase() {
    setLevel((l) => l + 1);
    setFound(new Set());
    setResolved(false);
    setViewIndex(0);
    setCaption("Turn to look around. Something here doesn't add up.");
  }

  const crackActive = config.required.includes("crack");
  const decoyActive = config.hasDecoy;

  return (
    <ExperienceLayout title="The Impossible Room" category="Puzzle" accent="#6277d8" background="#111318">
      <div className={styles.stage}>
        <div className={styles.topBar}>
          <div className={styles.caseLabel}>Case {level}</div>
          <div className={styles.viewLabel}>{VIEWS[viewIndex]}</div>
        </div>

        <div className={styles.roomFrame}>
          <svg viewBox="0 0 320 240" className={styles.svg}>
            <rect x="0" y="0" width="320" height="240" fill="#1a1c22" />
            <line x1="0" y1="190" x2="320" y2="190" stroke="#3a3d47" strokeWidth={2} />

            {viewIndex === 0 && (
              <g>
                <rect x="30" y="60" width="70" height="130" fill="none" stroke="#b7b9b6" strokeWidth={2} />
                <rect x="200" y="70" width="80" height="60" fill="#232733" stroke="#b7b9b6" strokeWidth={2} />
                <line x1="240" y1="70" x2="240" y2="130" stroke="#b7b9b6" strokeWidth={1} />
                <line x1="200" y1="100" x2="280" y2="100" stroke="#b7b9b6" strokeWidth={1} />
                <g
                  className={!found.has("frame") ? styles.hotspot : undefined}
                  onClick={() => collect("frame")}
                  opacity={found.has("frame") ? 0.35 : 1}
                >
                  <rect x="145" y="28" width="30" height="22" rx={2} fill="#e8e9e6" transform="rotate(8 160 39)" />
                </g>
                {crackActive && isUnlocked("crack") && (
                  <g
                    className={!found.has("crack") ? styles.hotspot : undefined}
                    onClick={() => collect("crack")}
                    opacity={found.has("crack") ? 0.5 : 1}
                  >
                    <path d="M 40 10 L 55 34 L 46 40 L 62 58" fill="none" stroke="#d36b6b" strokeWidth={2} />
                  </g>
                )}
              </g>
            )}

            {viewIndex === 1 && (
              <g>
                <rect x="20" y="70" width="90" height="110" fill="none" stroke="#b7b9b6" strokeWidth={2} />
                {Array.from({ length: 4 }).map((_, i) => (
                  <line key={i} x1="20" y1={90 + i * 24} x2="110" y2={90 + i * 24} stroke="#b7b9b6" strokeWidth={1} />
                ))}
                <g
                  className={!found.has("mirror") ? styles.hotspot : undefined}
                  onClick={() => collect("mirror")}
                >
                  <rect x="190" y="60" width="70" height="100" fill="#20242e" stroke="#e8e9e6" strokeWidth={2} />
                  <rect x="198" y="72" width="54" height="76" fill={found.has("mirror") ? "#2b3350" : "#171a20"} opacity={found.has("mirror") ? 0.9 : 0.6} />
                  {found.has("mirror") && <circle cx="225" cy="110" r="14" fill="#6277d8" opacity={0.6} />}
                </g>
                {decoyActive && (
                  <g className={styles.hotspot} onClick={clickDecoy}>
                    <rect x="40" y="90" width="40" height="30" fill="#2a2d38" stroke="#8b93a3" strokeWidth={1.5} />
                    <line x1="46" y1="112" x2="74" y2="98" stroke="#8b93a3" strokeWidth={1} />
                  </g>
                )}
              </g>
            )}

            {viewIndex === 2 && (
              <g>
                <rect x="120" y="70" width="70" height="120" fill="none" stroke="#b7b9b6" strokeWidth={2} />
                <rect x="120" y="70" width="4" height="120" fill="#b7b9b6" />
                <g
                  className={!found.has("stairs") ? styles.hotspot : undefined}
                  onClick={() => collect("stairs")}
                >
                  <rect x="230" y="90" width="50" height="70" fill="#171a20" stroke="#3a3d47" strokeWidth={1} />
                  {Array.from({ length: 5 }).map((_, i) => (
                    <rect key={i} x={234 + i * 8} y={150 - i * 10} width="30" height="5" fill="#8b93a3" opacity={found.has("stairs") ? 1 : 0.5} />
                  ))}
                </g>
              </g>
            )}

            {viewIndex === 3 && (
              <g>
                <rect x="120" y="55" width="80" height="60" fill="#0b0e18" stroke="#b7b9b6" strokeWidth={2} />
                <circle cx="145" cy="75" r="1.4" fill="#e8e9e6" />
                <circle cx="165" cy="65" r="1" fill="#e8e9e6" />
                <circle cx="180" cy="85" r="1.4" fill="#e8e9e6" />
                <circle cx="155" cy="95" r="1" fill="#e8e9e6" />
                {allFound && (
                  <g className={!resolved ? styles.hotspot : undefined} onClick={openDoor}>
                    <rect x="20" y="80" width="55" height="100" fill="none" stroke="#6277d8" strokeWidth={2.5} />
                    <circle cx="30" cy="132" r="2" fill="#6277d8" />
                  </g>
                )}
              </g>
            )}
          </svg>
        </div>

        <p className={styles.caption}>{caption}</p>

        <div className={styles.controls}>
          <button type="button" className={styles.button} onClick={() => turn(-1)}>
            ← Turn
          </button>
          <div className={styles.progress}>{found.size}/{config.required.length} found</div>
          <button type="button" className={styles.button} onClick={() => turn(1)}>
            Turn →
          </button>
        </div>

        {resolved && (
          <div className={styles.resolvedPanel}>
            <p className={styles.resolvedText}>
              The door led back in. The mirror still isn't showing this room.
              Nothing was ever fixed — you just learned how it thinks.
            </p>
            <button type="button" className={styles.resetButton} onClick={nextCase}>
              A stranger room →
            </button>
          </div>
        )}
      </div>
    </ExperienceLayout>
  );
}
