import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import styles from "./SoundGarden.module.css";

// A pentatonic scale — no combination of these notes can sound "wrong,"
// so casual clicking always produces something pleasant.
const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

const COLORS = ["#4e9467", "#61ced2", "#e77ca7", "#8a75c8", "#e6b968"];

type Voice = "reed" | "flower" | "bell";

interface Plant {
  id: string;
  voice: Voice;
  note: number;
  color: string;
  height: number;
  x: number; // 0-100, percentage across the bed
  swayOffset: number;
}

function buildPlants(): Plant[] {
  const plants: Plant[] = [];
  const reedNotes = SCALE.slice(0, 7).map((f) => f / 2);
  reedNotes.forEach((note, i) => {
    plants.push({
      id: `reed-${i}`,
      voice: "reed",
      note,
      color: "#3a6b4e",
      height: 46 + ((i * 17) % 22),
      x: 4 + (i / reedNotes.length) * 92,
      swayOffset: (i * 0.5) % 3,
    });
  });
  SCALE.forEach((note, i) => {
    plants.push({
      id: `flower-${i}`,
      voice: "flower",
      note,
      color: COLORS[i % COLORS.length],
      height: 62 + ((i * 37) % 46),
      x: 2 + (i / SCALE.length) * 96,
      swayOffset: (i * 0.6) % 3,
    });
  });
  const bellNotes = SCALE.slice(0, 5).map((f) => f * 2);
  bellNotes.forEach((note, i) => {
    plants.push({
      id: `bell-${i}`,
      voice: "bell",
      note,
      color: "#e6b968",
      height: 30,
      x: 10 + (i / bellNotes.length) * 80,
      swayOffset: (i * 0.7) % 3,
    });
  });
  return plants;
}

const PLANTS = buildPlants();

interface Ripple {
  id: number;
  x: number;
  y: number;
  color: string;
}

interface Firefly {
  x: number;
  y: number;
  delay: number;
  duration: number;
}

const FIREFLIES: Firefly[] = Array.from({ length: 14 }, (_, i) => ({
  x: (i * 37) % 100,
  y: 8 + ((i * 23) % 45),
  delay: (i * 0.9) % 6,
  duration: 5 + (i % 4),
}));

let rippleId = 0;

export function SoundGarden() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const droneNodesRef = useRef<{ oscs: OscillatorNode[]; gain: GainNode } | null>(null);
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const timeoutsRef = useRef<Map<string, number>>(new Map());
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [notesPlayed, setNotesPlayed] = useState(0);
  const [droneOn, setDroneOn] = useState(false);
  const [reducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      audioCtxRef.current?.close();
      timeouts.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  function getAudioContext(): AudioContext {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }

  function playVoice(plant: Plant) {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    if (plant.voice === "reed") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = plant.note;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 2.5);
    } else if (plant.voice === "bell") {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.value = plant.note;
      osc2.frequency.value = plant.note * 2.01;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.13, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.6);
      osc2.stop(now + 1.6);
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = plant.note;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.35);
    }
  }

  function play(plant: Plant, clientX: number, clientY: number) {
    playVoice(plant);
    setNotesPlayed((n) => n + 1);
    setActiveIds((prev) => new Set(prev).add(plant.id));

    const existing = timeoutsRef.current.get(plant.id);
    if (existing) window.clearTimeout(existing);
    const timeout = window.setTimeout(() => {
      setActiveIds((prev) => {
        const next = new Set(prev);
        next.delete(plant.id);
        return next;
      });
      timeoutsRef.current.delete(plant.id);
    }, 650);
    timeoutsRef.current.set(plant.id, timeout);

    if (!reducedMotion) {
      const id = rippleId++;
      setRipples((prev) => [...prev, { id, x: clientX, y: clientY, color: plant.color }]);
      window.setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 900);
    }
  }

  function onPointerEnter(e: React.PointerEvent, plant: Plant) {
    if (e.buttons === 1) play(plant, e.clientX, e.clientY);
  }

  function toggleDrone() {
    const ctx = getAudioContext();
    if (droneOn) {
      const nodes = droneNodesRef.current;
      if (nodes) {
        const now = ctx.currentTime;
        nodes.gain.gain.linearRampToValueAtTime(0, now + 1.2);
        nodes.oscs.forEach((o) => o.stop(now + 1.3));
      }
      droneNodesRef.current = null;
      setDroneOn(false);
    } else {
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 1.5);
      gain.connect(ctx.destination);
      const droneNotes = [SCALE[0] / 2, SCALE[2] / 2, SCALE[4]];
      const oscs = droneNotes.map((freq) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;
        osc.connect(gain);
        osc.start(now);
        return osc;
      });
      droneNodesRef.current = { oscs, gain };
      setDroneOn(true);
    }
  }

  return (
    <ExperienceLayout title="Sound Garden" category="Interactive Art" accent="#61ced2" background="#0d1a16">
      <div className={styles.stage}>
        <div className={styles.sky}>
          {!reducedMotion &&
            FIREFLIES.map((f, i) => (
              <span
                key={i}
                className={styles.firefly}
                style={{
                  left: `${f.x}%`,
                  top: `${f.y}%`,
                  animationDelay: `${f.delay}s`,
                  animationDuration: `${f.duration}s`,
                }}
              />
            ))}
        </div>

        <div className={styles.hint}>
          Touch the plants. Drag across a few of them at once — reeds
          hum low, flowers ring clear, bells chime bright. Nothing here
          can sound wrong.
        </div>

        <button type="button" className={`${styles.droneButton} ${droneOn ? styles.droneOn : ""}`} onClick={toggleDrone}>
          {droneOn ? "Let the hum fade" : "Start an ambient hum"}
        </button>

        <div className={`${styles.garden} ${reducedMotion ? styles.stillGarden : ""}`}>
          {PLANTS.map((plant) => (
            <button
              key={plant.id}
              type="button"
              className={`${styles.plantButton} ${styles[plant.voice]}`}
              style={{ "--sway-delay": `${plant.swayOffset}s`, left: `${plant.x}%`, height: plant.height + 40 } as React.CSSProperties}
              onPointerDown={(e) => play(plant, e.clientX, e.clientY)}
              onPointerEnter={(e) => onPointerEnter(e, plant)}
              aria-label={`${plant.voice}, note`}
            >
              <span
                className={`${styles.head} ${activeIds.has(plant.id) ? styles.headActive : ""}`}
                style={{ background: plant.color, boxShadow: `0 0 18px 4px ${plant.color}55` } as React.CSSProperties}
              >
                {plant.voice === "flower" &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <span
                      key={i}
                      className={styles.petal}
                      style={{ transform: `rotate(${(360 / 5) * i}deg) translateY(-14px)`, background: plant.color } as React.CSSProperties}
                    />
                  ))}
              </span>
              <span className={styles.stem} style={{ height: plant.height }} />
            </button>
          ))}
        </div>

        {ripples.map((r) => (
          <span
            key={r.id}
            className={styles.ripple}
            style={{ left: r.x, top: r.y, borderColor: r.color } as React.CSSProperties}
          />
        ))}

        <div className={styles.readout}>{notesPlayed} notes played</div>
      </div>
    </ExperienceLayout>
  );
}
