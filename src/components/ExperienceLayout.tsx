import type { ReactNode } from "react";
import { TLink as Link } from "./Transition";
import { Mark } from "./Logo";
import { SoundControl } from "./SoundControl";
import styles from "./ExperienceLayout.module.css";

export function ExperienceLayout({
  title,
  category,
  accent,
  background,
  light,
  children,
}: {
  title: string;
  category: string;
  accent: string;
  background?: string;
  /** Set when the experience's own background is light — flips the chrome text to dark. */
  light?: boolean;
  children: ReactNode;
}) {
  const wrapStyle = {
    "--exp-accent": accent,
    ...(background ? { "--exp-bg": background } : {}),
  } as React.CSSProperties;

  return (
    <div className={`${styles.wrap} ${light ? styles.light : ""}`} style={wrapStyle}>
      <div className={styles.chrome}>
        <Link to="/" className={styles.back}>
          <Mark size={18} /> Mirari
        </Link>
        <div className={styles.right}>
          <SoundControl />
          <div className={styles.titleBlock}>
            <span className={styles.title}>{title}</span>
            <span className={styles.categoryTag}>{category}</span>
          </div>
        </div>
      </div>
      <div className={styles.stage}>{children}</div>
    </div>
  );
}
