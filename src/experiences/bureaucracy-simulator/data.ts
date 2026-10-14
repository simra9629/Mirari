import { makeRng } from "../../lib/rng";

export interface BureaucracyStep {
  id: string;
  text: string;
  detail: string;
  wait?: boolean;
  /** An alternative, riskier way to clear this one step. */
  expressLabel?: string;
  expressSuccessChance?: number;
  expressSuccessLine?: string;
  expressFailLine?: string;
}

const DEPARTMENTS = ["Department B", "Records", "Intake", "Compliance", "the Annex", "Sub-Registry 3"];
const FORMS = ["Form A-17", "Form C-9", "Form Q-2 (revised)", "Form 88-B", "the Continuance Slip"];

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function buildPool(rand: () => number): BureaucracyStep[] {
  const dept = pick(rand, DEPARTMENTS);
  const dept2 = pick(rand, DEPARTMENTS.filter((d) => d !== dept));
  const form = pick(rand, FORMS);
  const form2 = pick(rand, FORMS.filter((f) => f !== form));

  return [
    { id: "start", text: "Obtain a stamp.", detail: "Should be simple enough." },
    { id: "need-form", text: `You need ${form} first.`, detail: "Nobody stamps anything without it." },
    {
      id: "signature",
      text: `${form} requires a signature from ${dept}.`,
      detail: `${dept} is down the hall. Or up a floor. Ask around.`,
      expressLabel: "Try the walk-in window instead",
      expressSuccessChance: 0.5,
      expressSuccessLine: "The walk-in clerk signs it without a word. Occasionally the system works.",
      expressFailLine: "The walk-in window is for a different form entirely. Back to the hall.",
    },
    {
      id: "triplicate",
      text: `${dept} needs ${form} submitted in triplicate.`,
      detail: "The form you don't have yet, three times.",
    },
    { id: "copies", text: `Make two additional copies of ${form}.`, detail: "The copier is in a different building." },
    { id: "queue", text: "Wait in the queue to submit the copies.", detail: "Processing\u2026", wait: true },
    {
      id: "missing-doc",
      text: "One supporting document is missing from your submission.",
      detail: "It always is.",
    },
    {
      id: "appointment",
      text: "Book an appointment to request the missing document.",
      detail: "The earliest slot is regrettably specific.",
      expressLabel: "Ask if they can just email it",
      expressSuccessChance: 0.35,
      expressSuccessLine: "Someone actually emails it. You are suspicious of your own good luck.",
      expressFailLine: "\"We don't do that here.\" The appointment stands.",
    },
    { id: "wait-appt", text: "Wait for your appointment.", detail: "Processing\u2026", wait: true },
    {
      id: "wrong-office",
      text: `${dept2} says this was never their form to begin with.`,
      detail: "They redirect you back to where you started, cheerfully.",
    },
    {
      id: "second-form",
      text: `Also bring ${form2}, which references the first form by a name it no longer uses.`,
      detail: "The renaming happened in a memo nobody received.",
    },
    {
      id: "photocopy-id",
      text: "Provide a photocopy of your original request.",
      detail: "The original request was, itself, a photocopy.",
    },
    {
      id: "fee",
      text: "Pay the processing fee, in the exact amount, in cash.",
      detail: "The cashier is on lunch. Lunch is two hours long today.",
    },
    { id: "final-queue", text: "Return to the queue for final review.", detail: "Processing\u2026", wait: true },
    { id: "return", text: "Return with the completed documents.", detail: "Almost there. Probably." },
  ];
}

export interface JanetEncounter {
  available: boolean;
  hint: string;
  successChance: number;
  successLine: string;
  failLine: string;
}

const JANET_HINTS_PRESENT = [
  "Someone mentions a woman named Janet, three desks over.",
  "You notice a desk with a nameplate: JANET. She's in.",
  "A coworker whispers that Janet handles this sort of thing, unofficially.",
];
const JANET_HINTS_ABSENT = [
  "You ask about Janet. She's out today.",
  "Janet's desk is empty. A sign says BACK IN 15 MIN. It's been there a while.",
  "Someone mentions Janet, then remembers she's in a meeting until further notice.",
];
const JANET_SUCCESS = [
  "Janet has a stamp in her drawer. She uses it without looking up.",
  "Janet doesn't ask any questions. She just stamps it.",
  "Janet recognizes the form immediately and stamps it before you finish explaining.",
];
const JANET_FAIL = [
  "\"Oh, that's not actually my desk anymore,\" Janet says. Back to the queue.",
  "Janet looks at the form for a long moment. \"This isn't mine to sign.\" You've lost a step.",
  "Janet is on the phone. She waves you off. Nothing gained, a little time lost.",
];

/**
 * Whether Janet's shortcut exists at all this visit, and how it plays out if
 * taken \u2014 re-rolled every visit so she's a loophole you sometimes get
 * lucky with, not a button that always works.
 */
export function rollJanet(rand: () => number): JanetEncounter {
  const available = rand() < 0.65;
  const successChance = 0.5 + rand() * 0.25;
  return {
    available,
    hint: pick(rand, available ? JANET_HINTS_PRESENT : JANET_HINTS_ABSENT),
    successChance,
    successLine: pick(rand, JANET_SUCCESS),
    failLine: pick(rand, JANET_FAIL),
  };
}

export const SUCCESS_LINES = [
  "Stamped. It took what it took.",
  "Stamped. You will frame this, out of spite.",
  "Stamped. The stamp itself took less than a second.",
  "Stamped. Somewhere, a filing cabinet grows heavier.",
];

export interface Visit {
  steps: BureaucracyStep[];
  janet: JanetEncounter;
  janetUnlockAt: number;
}

/** Assembles one visit: a shuffled subset of the step pool, plus Janet's odds this time. */
export function generateVisit(visitNumber: number): Visit {
  const rand = makeRng(visitNumber * 92821 + 17);
  const pool = buildPool(rand);

  const fixedStart = pool[0];
  const fixedEnd = pool[pool.length - 1];
  const middle = pool.slice(1, -1);
  for (let i = middle.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [middle[i], middle[j]] = [middle[j], middle[i]];
  }
  const count = 5 + Math.floor(rand() * 3);
  const steps = [fixedStart, ...middle.slice(0, count), fixedEnd];

  const janet = rollJanet(rand);
  const janetUnlockAt = 2 + Math.floor(rand() * 2);

  return { steps, janet, janetUnlockAt };
}
