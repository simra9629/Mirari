import styles from "./Logo.module.css";

export function Mark({ size = 44 }: { size?: number }) {
  return (
    <span
      className={styles.mark}
      style={{ "--mark-size": `${size}px` } as React.CSSProperties}
      aria-hidden="true"
    >
      <svg viewBox="0 0 44 44">
        <g className={styles.ring}>
          <circle
            cx="22"
            cy="22"
            r="19"
            fill="none"
            stroke="var(--mirari-periwinkle)"
            strokeOpacity="0.4"
            strokeWidth="1"
          />
          <circle cx="22" cy="3" r="1.6" fill="var(--mirari-periwinkle-pale)" />
        </g>
        <g className={styles.ringInner}>
          <circle
            cx="22"
            cy="22"
            r="12.5"
            fill="none"
            stroke="var(--mirari-cyan)"
            strokeOpacity="0.35"
            strokeWidth="1"
          />
          <circle cx="34.5" cy="22" r="1.2" fill="var(--mirari-cyan)" />
        </g>
        <circle
          className={styles.core}
          cx="22"
          cy="22"
          r="5.2"
          fill="var(--mirari-periwinkle)"
          style={{ filter: "drop-shadow(0 0 8px var(--mirari-periwinkle))" }}
        />
      </svg>
    </span>
  );
}

export function Wordmark({
  size,
  markSize,
  as: Tag = "h1",
}: {
  size?: string;
  markSize?: number;
  as?: "h1" | "span" | "div";
}) {
  return (
    <Tag
      className={styles.wordmarkRow}
      style={{ "--wordmark-size": size } as React.CSSProperties}
    >
      <Mark size={markSize} />
      <span className={styles.wordmark}>Mirari</span>
    </Tag>
  );
}
