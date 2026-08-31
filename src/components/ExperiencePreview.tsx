import { Link } from "react-router-dom";
import type { Experience } from "../data/types";
import styles from "./ExperiencePreview.module.css";

const CATEGORY_LABEL: Record<string, string> = {
  games: "Game",
  puzzles: "Puzzle",
  science: "Science",
  "tiny-worlds": "Tiny World",
  "interactive-art": "Interactive Art",
  history: "History",
  experiments: "Experiment",
  strange: "Strange Thing",
};

export function ExperiencePreview({
  experience,
  size = "md",
}: {
  experience: Experience;
  size?: "sm" | "md" | "lg";
}) {
  const available = experience.status === "available";
  const content = (
    <>
      <span className={styles.glow} aria-hidden="true" />
      <span className={styles.motif} aria-hidden="true" />
      {!available && <span className={styles.badge}>Coming soon</span>}
      <span className={styles.eyebrow}>{CATEGORY_LABEL[experience.category]}</span>
      <h3 className={styles.title}>{experience.title}</h3>
      <p className={styles.description}>{experience.description}</p>
    </>
  );

  const cardClass = [
    styles.card,
    styles[size],
    available ? styles.available : styles.dormant,
  ]
    .filter(Boolean)
    .join(" ");
  const cardStyle = { "--card-accent": experience.accent } as React.CSSProperties;

  if (available && experience.route) {
    return (
      <Link
        to={experience.route}
        className={cardClass}
        style={cardStyle}
        aria-label={`Open ${experience.title} — ${experience.description}`}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      className={cardClass}
      style={cardStyle}
      aria-label={`${experience.title} — coming soon`}
    >
      {content}
    </div>
  );
}
