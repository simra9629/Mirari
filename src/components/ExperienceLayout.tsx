import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Mark } from "./Logo";
import styles from "./ExperienceLayout.module.css";

export function ExperienceLayout({
  title,
  category,
  accent,
  background,
  children,
}: {
  title: string;
  category: string;
  accent: string;
  background?: string;
  children: ReactNode;
}) {
  const wrapStyle = {
    "--exp-accent": accent,
    ...(background ? { "--exp-bg": background } : {}),
  } as React.CSSProperties;

  return (
    <div className={styles.wrap} style={wrapStyle}>
      <div className={styles.chrome}>
        <Link to="/" className={styles.back}>
          <Mark size={18} /> Mirari
        </Link>
        <div className={styles.titleBlock}>
          <span className={styles.title}>{title}</span>
          <span className={styles.categoryTag}>{category}</span>
        </div>
      </div>
      <div className={styles.stage}>{children}</div>
    </div>
  );
}
