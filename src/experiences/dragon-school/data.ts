import type { RingLevel, FireLevel, LandingLevel, RescueLevel } from "./engine";

export type LessonKind = "flight" | "speed" | "fire" | "precision" | "rescue";

export interface Lesson {
  id: string;
  kind: LessonKind;
  rank: "Beginner" | "Apprentice" | "Adept" | "Advanced" | "Master";
  title: string;
  detail: string;
  controlHint: string;
  ring?: RingLevel;
  fire?: FireLevel;
  landing?: LandingLevel;
  rescue?: RescueLevel;
}

export const LESSONS: Lesson[] = [
  {
    id: "flight-1", kind: "flight", rank: "Beginner",
    title: "Fly through the rings",
    detail: "Collect all four rings before time runs out. Any order.",
    controlHint: "Arrow keys or WASD to fly.",
    ring: {
      ordered: false, timeLimit: 16, startX: 60, startY: 220,
      rings: [{ x: 200, y: 130, r: 28 }, { x: 380, y: 300, r: 28 }, { x: 560, y: 150, r: 28 }, { x: 320, y: 360, r: 28 }],
    },
  },
  {
    id: "fire-1", kind: "fire", rank: "Beginner",
    title: "Hit the targets",
    detail: "Aim with the pointer and hold to breathe fire. Hit 3 of 4 targets.",
    controlHint: "Move the pointer to aim, hold to breathe fire.",
    fire: {
      timeLimit: 16, requiredHits: 3,
      targets: [
        { x: 150, y: 150, r: 20, vx: 14, appearAt: 0, hitAt: null },
        { x: 380, y: 110, r: 20, vx: -16, appearAt: 1.5, hitAt: null },
        { x: 520, y: 220, r: 20, vx: 12, appearAt: 3, hitAt: null },
        { x: 260, y: 300, r: 20, vx: -14, appearAt: 4.5, hitAt: null },
      ],
    },
  },
  {
    id: "precision-1", kind: "precision", rank: "Apprentice",
    title: "Landing practice",
    detail: "Steer onto each platform and touch down gently — three landings in a row.",
    controlHint: "Arrow keys or A/D to steer while falling.",
    landing: {
      fallSpeed: 65,
      pads: [{ x: 350, y: 150, halfW: 60 }, { x: 200, y: 250, halfW: 46 }, { x: 500, y: 350, halfW: 34 }],
    },
  },
  {
    id: "speed-1", kind: "speed", rank: "Apprentice",
    title: "Checkpoint race",
    detail: "Pass through the checkpoints in order, against the clock.",
    controlHint: "Arrow keys or WASD to fly.",
    ring: {
      ordered: true, timeLimit: 10, startX: 40, startY: 220,
      rings: [{ x: 150, y: 100, r: 24 }, { x: 350, y: 320, r: 24 }, { x: 550, y: 100, r: 24 }, { x: 650, y: 360, r: 24 }],
    },
  },
  {
    id: "rescue-1", kind: "rescue", rank: "Adept",
    title: "Rescue run",
    detail: "Reach the student, carry them to the safe zone. Hazards knock them loose — you'll have to go back.",
    controlHint: "Arrow keys or WASD to fly.",
    rescue: {
      studentX: 380, studentY: 300, safeX: 650, safeY: 80, timeLimit: 18,
      hazards: [{ x: 280, y: 180, r: 20, vx: 26, vy: 0 }, { x: 480, y: 140, r: 20, vx: -22, vy: 16 }],
    },
  },
  {
    id: "flight-2", kind: "flight", rank: "Adept",
    title: "Six rings, less time",
    detail: "The same idea. More rings. Less room for error.",
    controlHint: "Arrow keys or WASD to fly.",
    ring: {
      ordered: false, timeLimit: 15, startX: 50, startY: 220,
      rings: [
        { x: 150, y: 100, r: 24 }, { x: 320, y: 340, r: 24 }, { x: 500, y: 110, r: 24 },
        { x: 620, y: 260, r: 24 }, { x: 260, y: 200, r: 24 }, { x: 440, y: 380, r: 24 },
      ],
    },
  },
  {
    id: "fire-2", kind: "fire", rank: "Advanced",
    title: "Fast targets",
    detail: "They move faster now, and there are more of them. Hit 5 of 6.",
    controlHint: "Move the pointer to aim, hold to breathe fire.",
    fire: {
      timeLimit: 15, requiredHits: 5,
      targets: [
        { x: 120, y: 140, r: 18, vx: 32, appearAt: 0, hitAt: null },
        { x: 400, y: 90, r: 18, vx: -34, appearAt: 1, hitAt: null },
        { x: 560, y: 250, r: 18, vx: 28, appearAt: 2.2, hitAt: null },
        { x: 220, y: 320, r: 18, vx: -30, appearAt: 3.5, hitAt: null },
        { x: 480, y: 180, r: 18, vx: 26, appearAt: 4.8, hitAt: null },
        { x: 300, y: 260, r: 18, vx: -28, appearAt: 6, hitAt: null },
      ],
    },
  },
  {
    id: "precision-2", kind: "precision", rank: "Master",
    title: "Four small platforms",
    detail: "The platforms get smaller each time. So does your margin for error.",
    controlHint: "Arrow keys or A/D to steer while falling.",
    landing: {
      fallSpeed: 68,
      pads: [
        { x: 350, y: 120, halfW: 50 }, { x: 180, y: 210, halfW: 38 },
        { x: 520, y: 300, halfW: 28 }, { x: 300, y: 390, halfW: 22 },
      ],
    },
  },
  {
    id: "speed-2", kind: "speed", rank: "Advanced",
    title: "Five checkpoints, less room",
    detail: "One more checkpoint. A little less time per checkpoint, too.",
    controlHint: "Arrow keys or WASD to fly.",
    ring: {
      ordered: true, timeLimit: 11, startX: 40, startY: 220,
      rings: [
        { x: 140, y: 90, r: 22 }, { x: 320, y: 300, r: 22 }, { x: 480, y: 100, r: 22 },
        { x: 600, y: 340, r: 22 }, { x: 660, y: 150, r: 22 },
      ],
    },
  },
  {
    id: "rescue-2", kind: "rescue", rank: "Advanced",
    title: "Three hazards this time",
    detail: "More to dodge, less time to do it in.",
    controlHint: "Arrow keys or WASD to fly.",
    rescue: {
      studentX: 420, studentY: 320, safeX: 660, safeY: 70, timeLimit: 15,
      hazards: [
        { x: 250, y: 160, r: 20, vx: 28, vy: 0 }, { x: 460, y: 130, r: 20, vx: -24, vy: 14 },
        { x: 560, y: 280, r: 20, vx: 20, vy: -18 },
      ],
    },
  },
  {
    id: "flight-3", kind: "flight", rank: "Master",
    title: "Eight rings, even less time",
    detail: "The whole school is watching this one.",
    controlHint: "Arrow keys or WASD to fly.",
    ring: {
      ordered: false, timeLimit: 17, startX: 50, startY: 220,
      rings: [
        { x: 130, y: 90, r: 22 }, { x: 300, y: 340, r: 22 }, { x: 470, y: 100, r: 22 },
        { x: 600, y: 250, r: 22 }, { x: 240, y: 190, r: 22 }, { x: 420, y: 380, r: 22 },
        { x: 560, y: 380, r: 22 }, { x: 660, y: 130, r: 22 },
      ],
    },
  },
  {
    id: "fire-3", kind: "fire", rank: "Master",
    title: "Seven targets, faster still",
    detail: "Hit 6 of 7. They don't sit still for long.",
    controlHint: "Move the pointer to aim, hold to breathe fire.",
    fire: {
      timeLimit: 17, requiredHits: 6,
      targets: [
        { x: 120, y: 130, r: 17, vx: 36, appearAt: 0, hitAt: null },
        { x: 400, y: 90, r: 17, vx: -38, appearAt: 0.8, hitAt: null },
        { x: 560, y: 240, r: 17, vx: 30, appearAt: 1.8, hitAt: null },
        { x: 220, y: 320, r: 17, vx: -32, appearAt: 3, hitAt: null },
        { x: 480, y: 180, r: 17, vx: 28, appearAt: 4.2, hitAt: null },
        { x: 300, y: 260, r: 17, vx: -30, appearAt: 5.4, hitAt: null },
        { x: 600, y: 340, r: 17, vx: 26, appearAt: 6.6, hitAt: null },
      ],
    },
  },
  {
    id: "rescue-3", kind: "rescue", rank: "Master",
    title: "The long way round",
    detail: "The safe zone is far away, and the sky between here and there isn't empty.",
    controlHint: "Arrow keys or WASD to fly.",
    rescue: {
      studentX: 500, studentY: 350, safeX: 60, safeY: 70, timeLimit: 17,
      hazards: [
        { x: 250, y: 140, r: 20, vx: 26, vy: 0 }, { x: 380, y: 260, r: 20, vx: -22, vy: 16 },
        { x: 180, y: 320, r: 20, vx: 24, vy: -14 }, { x: 460, y: 150, r: 20, vx: -20, vy: 12 },
      ],
    },
  },
  {
    id: "precision-3", kind: "precision", rank: "Master",
    title: "Five platforms",
    detail: "One more than before. The margins keep shrinking.",
    controlHint: "Arrow keys or A/D to steer while falling.",
    landing: {
      fallSpeed: 70,
      pads: [
        { x: 350, y: 110, halfW: 46 }, { x: 160, y: 190, halfW: 36 },
        { x: 540, y: 270, halfW: 28 }, { x: 250, y: 350, halfW: 22 },
        { x: 450, y: 400, halfW: 18 },
      ],
    },
  },
  {
    id: "fire-4", kind: "fire", rank: "Master",
    title: "The final lesson",
    detail: "Eight targets. Need 6. This is the one they'll remember.",
    controlHint: "Move the pointer to aim, hold to breathe fire.",
    fire: {
      timeLimit: 19, requiredHits: 6,
      targets: [
        { x: 110, y: 120, r: 16, vx: 40, appearAt: 0, hitAt: null },
        { x: 420, y: 80, r: 16, vx: -42, appearAt: 0.7, hitAt: null },
        { x: 580, y: 220, r: 16, vx: 34, appearAt: 1.6, hitAt: null },
        { x: 200, y: 300, r: 16, vx: -36, appearAt: 2.6, hitAt: null },
        { x: 500, y: 170, r: 16, vx: 32, appearAt: 3.6, hitAt: null },
        { x: 280, y: 250, r: 16, vx: -34, appearAt: 4.6, hitAt: null },
        { x: 620, y: 330, r: 16, vx: 30, appearAt: 5.6, hitAt: null },
        { x: 350, y: 350, r: 16, vx: -28, appearAt: 6.8, hitAt: null },
      ],
    },
  },
];

const RANK_ORDER: Lesson["rank"][] = ["Beginner", "Apprentice", "Adept", "Advanced", "Master"];
export const RANKS = RANK_ORDER;

const STORAGE_KEY = "mirari-dragon-school-progress";

export interface Progress {
  completed: string[];
  bestTimes: Record<string, number>;
}

function defaultProgress(): Progress {
  return { completed: [], bestTimes: {} };
}

export function loadProgress(): Progress {
  if (typeof window === "undefined") return defaultProgress();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw);
    return {
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      bestTimes: typeof parsed.bestTimes === "object" && parsed.bestTimes ? parsed.bestTimes : {},
    };
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(p: Progress) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // best-effort
  }
}

export function completeLesson(progress: Progress, lessonId: string, time: number): Progress {
  const completed = progress.completed.includes(lessonId) ? progress.completed : [...progress.completed, lessonId];
  const prevBest = progress.bestTimes[lessonId];
  const bestTimes = prevBest === undefined || time < prevBest
    ? { ...progress.bestTimes, [lessonId]: time }
    : progress.bestTimes;
  return { completed, bestTimes };
}

export function currentRank(progress: Progress): Lesson["rank"] {
  let best = 0;
  for (const lesson of LESSONS) {
    if (progress.completed.includes(lesson.id)) {
      best = Math.max(best, RANK_ORDER.indexOf(lesson.rank));
    }
  }
  return RANK_ORDER[best];
}
