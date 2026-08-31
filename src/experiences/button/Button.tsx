import { useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import styles from "./Button.module.css";

const REACTIONS = [
  "You pressed it.",
  "It did nothing. You pressed it anyway.",
  "Somewhere, a very small bell did not ring.",
  "Nothing happened. That was the point.",
  "It's a button. You're doing great.",
  "This is between you and the button now.",
  "The button appreciates the attention.",
  "Still just a button.",
  "That one felt different, didn't it? It wasn't.",
  "You are, statistically, the kind of person who presses buttons.",
  "It gave nothing back. It never will.",
  "Consider: what did you expect?",
  "The button has no opinion on this.",
  "Another press, logged and immediately forgotten.",
  "It's holding up well, all things considered.",
  "Nothing is happening extremely reliably.",
  "That was, by any measure, a press.",
  "The button remains a button.",
  "You could stop. You won't.",
  "This is the whole experience.",
];

const MILESTONES: Record<number, string> = {
  1: "First press. There will be more.",
  10: "Ten presses. It notices now.",
  25: "Twenty-five. Some would call this a bit.",
  50: "Fifty presses. The button is unbothered.",
  100: "One hundred. A round, meaningless number.",
  250: "Two hundred fifty. You've made a habit of this.",
  500: "Five hundred. It's not going to do anything different.",
  1000: "One thousand presses. Genuinely, congratulations.",
};

function shuffledBag<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface Particle {
  id: number;
  dx: number;
  dy: number;
}

export function ButtonExperience() {
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState("There is one button. You are encouraged to press it.");
  const [pressed, setPressed] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const bagRef = useRef<string[]>([]);
  const particleId = useRef(0);

  function press() {
    const next = count + 1;
    setCount(next);

    if (MILESTONES[next]) {
      setMessage(MILESTONES[next]);
    } else {
      if (bagRef.current.length === 0) {
        bagRef.current = shuffledBag(REACTIONS);
      }
      setMessage(bagRef.current.pop()!);
    }

    setPressed(true);
    window.setTimeout(() => setPressed(false), 140);

    const burst: Particle[] = Array.from({ length: 10 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 50;
      particleId.current += 1;
      return {
        id: particleId.current,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
      };
    });
    setParticles((prev) => [...prev, ...burst]);
    window.setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !burst.includes(p)));
    }, 700);
  }

  return (
    <ExperienceLayout
      title="Button"
      category="Strange Thing"
      accent="#7C82FF"
      background="#07070f"
    >
      <div className={styles.stage}>
        <div className={styles.count}>{count} presses</div>
        <div className={styles.buttonWrap}>
          <button
            type="button"
            className={`${styles.bigButton} ${pressed ? styles.pressed : ""}`}
            onClick={press}
            aria-label="The button"
          />
          {particles.map((p) => (
            <span
              key={p.id}
              className={styles.particle}
              style={{ "--dx": `${p.dx}px`, "--dy": `${p.dy}px` } as React.CSSProperties}
            />
          ))}
        </div>
        <p className={styles.message}>{message}</p>
      </div>
    </ExperienceLayout>
  );
}
