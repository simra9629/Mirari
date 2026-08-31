export type Category =
  | "games"
  | "puzzles"
  | "science"
  | "tiny-worlds"
  | "interactive-art"
  | "history"
  | "experiments"
  | "strange";

export type ExperienceStatus = "available" | "coming-soon";

export interface Experience {
  id: string;
  title: string;
  category: Category;
  /** One line — what the player does, not what the tech stack is. */
  description: string;
  status: ExperienceStatus;
  /** A short phrase used as the tiny signature glyph/motif for this experience's card. */
  motif: string;
  /** Per-experience accent color, drawn from its own art direction. */
  accent: string;
  route?: string;
}

export interface CategoryInfo {
  id: Category;
  label: string;
  description: string;
}
