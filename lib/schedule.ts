import type { Attempt, Grade, Progress, QState, Question } from './types.js';

/** Days until a question is due again, by Leitner box. Box 0 = struggling, last box = mastered. */
export const INTERVALS = [1, 2, 4, 8, 16, 30] as const;
export const MAX_BOX = INTERVALS.length - 1;

/** Weight floor for a not-yet-due question, so mastered material still resurfaces now and then. */
export const FLOOR_WEIGHT = 0.12;
/** Base weight for a question that has never been asked. */
export const NEW_WEIGHT = 1.2;
/** Extra pull for a struggling (box 0) question that is due, so it beats brand-new material. */
export const STRUGGLING_BONUS = 2;
/** How fast old attempts stop mattering when judging how weak a concept is. */
export const HALF_LIFE_DAYS = 10;
/** Weakness assumed for a concept with no evidence. Also the prior old evidence decays toward. */
export const UNSEEN_WEAKNESS = 0.4;
const PRIOR_WEIGHT = 0.5;

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** YYYY-MM-DD in Toronto time, which is the only clock Tom lives by. */
export function todayToronto(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function emptyState(): QState {
  return { attempts: [], box: 0 };
}

/**
 * 0 = missed it: back to box 0 (asked again tomorrow).
 * 1 = partial / needed a hint: drop one box.
 * 2 = good: up one box.
 * 3 = solid: up two boxes.
 */
export function nextBox(box: number, grade: Grade): number {
  switch (grade) {
    case 0:
      return 0;
    case 1:
      return Math.max(0, box - 1);
    case 2:
      return Math.min(MAX_BOX, box + 1);
    case 3:
      return Math.min(MAX_BOX, box + 2);
  }
}

export function boxLabel(box: number, attempts: number): string {
  if (attempts === 0) return 'new';
  if (box === 0) return 'struggling';
  if (box <= 2) return 'improving';
  if (box <= 4) return 'solid';
  return 'mastered';
}

/**
 * A "leech": the last three graded answers were all 1 or below. Asking the same thing again
 * isn't helping, so the routine should rephrase it, split it into a smaller prerequisite
 * question, or point Tom at a study chat instead.
 */
export function isLeech(state: QState): boolean {
  const last = state.attempts.slice(-3);
  return last.length === 3 && last.every((a) => a.grade <= 1);
}

export function applyGrade(
  state: QState,
  grade: Grade,
  date: string,
  origin: Attempt['origin'],
  note?: string,
): QState {
  const box = nextBox(state.box, grade);
  const attempt: Attempt = { date, grade, origin, ...(note ? { note } : {}) };
  return {
    attempts: [...state.attempts, attempt],
    box,
    lastAsked: date,
    nextDue: addDays(date, INTERVALS[box] as number),
  };
}

/**
 * 0 (solid) to 1 (consistently missing). Recent attempts count more, and with no recent
 * evidence the score drifts back toward UNSEEN_WEAKNESS, so a concept can't look mastered
 * (or hopeless) forever on the strength of one old answer.
 */
export function weaknessOf(
  attempts: ReadonlyArray<{ date: string; grade: Grade }>,
  today: string,
): number {
  let num = UNSEEN_WEAKNESS * PRIOR_WEIGHT;
  let den = PRIOR_WEIGHT;
  for (const a of attempts) {
    const age = Math.max(0, daysBetween(a.date, today));
    const w = Math.pow(0.5, age / HALF_LIFE_DAYS);
    num += (w * (3 - a.grade)) / 3;
    den += w;
  }
  return num / den;
}

function conceptKeys(q: Question): string[] {
  return [`topic:${q.topic}`, ...q.tags.map((t) => `tag:${t}`)];
}

/** Average weakness across a question's topic and tags, pooling every question that shares them. */
export function conceptWeakness(
  q: Question,
  questions: ReadonlyArray<Question>,
  progress: Progress,
  today: string,
): number {
  const keys = conceptKeys(q);
  const scores = keys.map((key) => {
    const pooled: Attempt[] = [];
    for (const other of questions) {
      if (conceptKeys(other).includes(key)) {
        pooled.push(...(progress.questions[other.id]?.attempts ?? []));
      }
    }
    return weaknessOf(pooled, today);
  });
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/**
 * Selection weight. Three things multiply together:
 *  - how overdue the question is for its box (struggling questions come due daily),
 *  - how weak the surrounding concepts are (1x for solid up to 3x for shaky),
 *  - a floor, so mastered questions are rare but never gone.
 */
export function weightOf(
  q: Question,
  questions: ReadonlyArray<Question>,
  progress: Progress,
  today: string,
): number {
  const st = progress.questions[q.id] ?? emptyState();
  const boost = 1 + 2 * conceptWeakness(q, questions, progress, today);
  if (st.attempts.length === 0 || !st.lastAsked) return NEW_WEIGHT * boost;

  const since = daysBetween(st.lastAsked, today);
  if (since <= 0) return 0;
  const overdue = since / (INTERVALS[st.box] as number);
  const due = overdue >= 1 ? Math.min(3, overdue) : Math.max(FLOOR_WEIGHT, 0.5 * overdue * overdue);
  // A struggling question that has come due outranks fresh material: fix gaps before adding more.
  const struggling = st.box === 0 && overdue >= 1 ? STRUGGLING_BONUS : 1;
  return due * struggling * boost;
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small seeded PRNG so a given date always yields the same pick. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Weighted sampling without replacement. A second pick avoids repeating the first pick's topic. */
export function pickQuestions(
  n: number,
  questions: ReadonlyArray<Question>,
  progress: Progress,
  today: string,
  rng: () => number,
  exclude: ReadonlySet<string> = new Set(),
): string[] {
  const pool = questions.filter((q) => !exclude.has(q.id));
  const picked: Question[] = [];
  while (picked.length < n && pool.length > 0) {
    // The first slot of the day is a review: if anything is due, it comes from the due set.
    // That guarantees weak material gets daily attention however much new material is waiting.
    const due = picked.length === 0 ? pool.filter((q) => isDue(q, progress, today)) : [];
    const candidates = due.length > 0 ? due : pool;

    const weights = candidates.map((q) => {
      let w = weightOf(q, questions, progress, today);
      if (picked.some((p) => p.topic === q.topic)) w *= 0.4;
      return w;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let chosen: Question;
    if (total <= 0) {
      chosen = candidates[Math.floor(rng() * candidates.length)] as Question;
    } else {
      let r = rng() * total;
      let idx = 0;
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i] as number;
        idx = i;
        if (r <= 0) break;
      }
      chosen = candidates[idx] as Question;
    }
    pool.splice(pool.indexOf(chosen), 1);
    picked.push(chosen);
  }
  return picked.map((q) => q.id);
}

/** True when the question has been asked before and its box interval has elapsed. */
export function isDue(q: Question, progress: Progress, today: string): boolean {
  const st = progress.questions[q.id];
  if (!st || st.attempts.length === 0 || !st.lastAsked) return false;
  return daysBetween(st.lastAsked, today) / (INTERVALS[st.box] as number) >= 1;
}

export interface AssignResult {
  /** Everything Tom is being asked today, carried-over first. */
  ids: string[];
  carried: string[];
  fresh: string[];
  skipped: string[];
  progress: Progress;
}

/**
 * Builds today's set. Unanswered questions from the last run are carried over once, then
 * dropped with no penalty (silence isn't a wrong answer). Re-running on the same date is a
 * no-op, so a retried routine can't hand out a second set.
 */
export function assign(
  progress: Progress,
  questions: ReadonlyArray<Question>,
  today: string,
  count: number,
): AssignResult {
  const already = progress.history.find((h) => h.date === today);
  if (already) {
    return {
      ids: already.ids,
      carried: [],
      fresh: [],
      skipped: already.skipped ?? [],
      progress,
    };
  }

  const known = new Set(questions.map((q) => q.id));
  const kept: Progress['pending'] = [];
  const skipped: string[] = [];
  for (const p of progress.pending) {
    if (!known.has(p.id)) continue;
    if (p.carried >= 1) skipped.push(p.id);
    else kept.push({ ...p, carried: p.carried + 1 });
  }

  const slots = Math.max(0, count - kept.length);
  const rng = mulberry32(hashString(today));
  const fresh = pickQuestions(slots, questions, progress, today, rng, new Set(kept.map((p) => p.id)));

  const pending = [...kept, ...fresh.map((id) => ({ id, assigned: today, carried: 0 }))];
  const ids = pending.map((p) => p.id);
  const { dm: _dm, ...rest } = progress;
  const next: Progress = {
    ...rest,
    pending,
    history: [...progress.history, { date: today, ids, ...(skipped.length ? { skipped } : {}) }],
  };
  return { ids, carried: kept.map((p) => p.id), fresh, skipped, progress: next };
}

/** Records a grade and clears the question from pending. */
export function record(
  progress: Progress,
  id: string,
  grade: Grade,
  date: string,
  note?: string,
): Progress {
  const state = progress.questions[id] ?? emptyState();
  return {
    ...progress,
    questions: { ...progress.questions, [id]: applyGrade(state, grade, date, 'daily', note) },
    pending: progress.pending.filter((p) => p.id !== id),
  };
}
