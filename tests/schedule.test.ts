import { describe, expect, it } from 'vitest';
import {
  FLOOR_WEIGHT,
  INTERVALS,
  MAX_BOX,
  addDays,
  applyGrade,
  assign,
  emptyState,
  hashString,
  isLeech,
  mulberry32,
  nextBox,
  pickQuestions,
  record,
  todayToronto,
  weaknessOf,
  weightOf,
} from '../lib/schedule.js';
import type { Grade, Progress, Question } from '../lib/types.js';

function makeQ(id: string, topic: string, tags: string[] = [id]): Question {
  return {
    id,
    topic,
    tags,
    difficulty: 2,
    kind: 'explain',
    prompt: `Prompt for ${id}, long enough to pass validation.`,
    keyPoints: ['a', 'b'],
    source: 'test',
    added: '2026-01-01',
  };
}

function freshProgress(questions: Question[]): Progress {
  const p: Progress = { version: 1, questions: {}, pending: [], history: [] };
  for (const q of questions) p.questions[q.id] = emptyState();
  return p;
}

describe('box transitions', () => {
  it('sends a miss straight back to box 0', () => {
    expect(nextBox(4, 0)).toBe(0);
  });
  it('drops one box on a partial answer, never below 0', () => {
    expect(nextBox(3, 1)).toBe(2);
    expect(nextBox(0, 1)).toBe(0);
  });
  it('moves up one box on good, two on solid, capped at the top', () => {
    expect(nextBox(1, 2)).toBe(2);
    expect(nextBox(1, 3)).toBe(3);
    expect(nextBox(MAX_BOX, 3)).toBe(MAX_BOX);
  });
  it('schedules the next due date from the new box', () => {
    const s = applyGrade(emptyState(), 3, '2026-03-01', 'daily');
    expect(s.box).toBe(2);
    expect(s.nextDue).toBe(addDays('2026-03-01', INTERVALS[2]));
  });
});

describe('weakness', () => {
  const day = '2026-03-10';
  it('is low for solid answers and high for misses', () => {
    const solid = weaknessOf([{ date: day, grade: 3 }, { date: day, grade: 3 }], day);
    const missed = weaknessOf([{ date: day, grade: 0 }, { date: day, grade: 0 }], day);
    expect(solid).toBeLessThan(0.15);
    expect(missed).toBeGreaterThan(0.75);
  });
  it('drifts back toward the neutral prior as evidence ages', () => {
    const fresh = weaknessOf([{ date: '2026-03-10', grade: 0 }], '2026-03-10');
    const old = weaknessOf([{ date: '2026-01-10', grade: 0 }], '2026-03-10');
    expect(old).toBeLessThan(fresh);
    expect(old).toBeGreaterThan(0.35);
    expect(old).toBeLessThan(0.5);
  });
  it('flags a leech after three weak answers in a row', () => {
    let s = emptyState();
    for (const g of [1, 0, 1] as Grade[]) s = applyGrade(s, g, '2026-03-01', 'daily');
    expect(isLeech(s)).toBe(true);
    s = applyGrade(s, 2, '2026-03-02', 'daily');
    expect(isLeech(s)).toBe(false);
  });
});

describe('weights', () => {
  const qs = [makeQ('a-1', 'a'), makeQ('b-1', 'b'), makeQ('c-1', 'c'), makeQ('d-1', 'd')];
  const today = '2026-03-20';

  it('weights a due, struggling question far above a mastered one', () => {
    const p = freshProgress(qs);
    p.questions['a-1'] = applyGrade(emptyState(), 0, '2026-03-19', 'daily');
    let mastered = emptyState();
    for (let i = 0; i < 4; i++) mastered = applyGrade(mastered, 3, '2026-03-18', 'daily');
    p.questions['b-1'] = mastered;
    const struggling = weightOf(qs[0]!, qs, p, today);
    const solid = weightOf(qs[1]!, qs, p, today);
    expect(struggling).toBeGreaterThan(solid * 8);
  });

  it('never drops a mastered question to zero', () => {
    const p = freshProgress(qs);
    let mastered = emptyState();
    for (let i = 0; i < 4; i++) mastered = applyGrade(mastered, 3, '2026-03-19', 'daily');
    p.questions['b-1'] = mastered;
    expect(weightOf(qs[1]!, qs, p, today)).toBeGreaterThanOrEqual(FLOOR_WEIGHT);
  });

  it('never asks the same question twice on one date', () => {
    const p = freshProgress(qs);
    p.questions['a-1'] = applyGrade(emptyState(), 0, today, 'daily');
    expect(weightOf(qs[0]!, qs, p, today)).toBe(0);
  });

  it('boosts a question when its concept tag is weak elsewhere', () => {
    const tagged = [makeQ('x-1', 'x', ['shared']), makeQ('y-1', 'y', ['shared']), makeQ('z-1', 'z', ['other'])];
    const p = freshProgress(tagged);
    p.questions['x-1'] = applyGrade(emptyState(), 0, '2026-03-19', 'daily');
    // y-1 and z-1 are both new, but y-1 shares a weak tag with x-1.
    expect(weightOf(tagged[1]!, tagged, p, today)).toBeGreaterThan(weightOf(tagged[2]!, tagged, p, today));
  });
});

describe('picking', () => {
  const qs = Array.from({ length: 8 }, (_, i) => makeQ(`q-${i}`, i % 2 === 0 ? 'even' : 'odd'));

  it('is deterministic for a given date', () => {
    const p = freshProgress(qs);
    const a = pickQuestions(2, qs, p, '2026-03-20', mulberry32(hashString('2026-03-20')));
    const b = pickQuestions(2, qs, p, '2026-03-20', mulberry32(hashString('2026-03-20')));
    expect(a).toEqual(b);
  });

  it('makes the first slot a due review whenever something is due', () => {
    const p = freshProgress(qs);
    p.questions['q-5'] = applyGrade(emptyState(), 0, '2026-03-19', 'daily');
    // 7 brand-new questions compete with it, but the first slot must still be the due one.
    for (let seed = 1; seed <= 25; seed++) {
      const picks = pickQuestions(2, qs, p, '2026-03-20', mulberry32(seed));
      expect(picks[0]).toBe('q-5');
    }
  });

  it('returns distinct questions and respects exclusions', () => {
    const p = freshProgress(qs);
    const picks = pickQuestions(3, qs, p, '2026-03-20', mulberry32(7), new Set(['q-0']));
    expect(new Set(picks).size).toBe(3);
    expect(picks).not.toContain('q-0');
  });
});

describe('assign and record', () => {
  const qs = Array.from({ length: 6 }, (_, i) => makeQ(`q-${i}`, `t${i % 3}`));

  it('hands out the requested number and is idempotent within a day', () => {
    const p = freshProgress(qs);
    const first = assign(p, qs, '2026-03-20', 2);
    expect(first.ids).toHaveLength(2);
    const again = assign(first.progress, qs, '2026-03-20', 2);
    expect(again.ids).toEqual(first.ids);
    expect(again.progress.history).toHaveLength(1);
  });

  it('carries an unanswered question over once, then drops it without penalty', () => {
    const day1 = assign(freshProgress(qs), qs, '2026-03-20', 2);
    const unanswered = day1.ids[0]!;

    const day2 = assign(day1.progress, qs, '2026-03-21', 2);
    expect(day2.carried).toContain(unanswered);
    expect(day2.ids).toHaveLength(2);

    const day3 = assign(day2.progress, qs, '2026-03-22', 2);
    expect(day3.skipped).toContain(unanswered);
    expect(day3.ids).not.toContain(unanswered);
    // Silence is not a wrong answer: no attempt was logged.
    expect(day3.progress.questions[unanswered]!.attempts).toHaveLength(0);
  });

  it('clears the pending entry and logs the attempt when a grade is recorded', () => {
    const day1 = assign(freshProgress(qs), qs, '2026-03-20', 2);
    const id = day1.ids[0]!;
    const after = record(day1.progress, id, 2, '2026-03-21', 'good');
    expect(after.pending.map((p) => p.id)).not.toContain(id);
    expect(after.questions[id]!.attempts.at(-1)).toMatchObject({ grade: 2, origin: 'daily', note: 'good' });
  });

  it('formats a Toronto date', () => {
    expect(todayToronto(new Date('2026-11-06T15:00:00Z'))).toBe('2026-11-06');
  });
});

describe('simulated month', () => {
  // One question Tom keeps getting wrong, nine he answers well. Over 60 days the struggling
  // one should come up far more often, and the mastered ones should still resurface.
  const qs = Array.from({ length: 10 }, (_, i) => makeQ(`q-${i}`, i % 2 === 0 ? 'even' : 'odd'));
  const counts: Record<string, number> = {};
  let p = freshProgress(qs);

  for (let day = 0; day < 60; day++) {
    const today = addDays('2026-01-01', day);
    const res = assign(p, qs, today, 2);
    p = res.progress;
    for (const id of res.ids) {
      counts[id] = (counts[id] ?? 0) + 1;
      p = record(p, id, id === 'q-0' ? 1 : 3, today);
    }
  }

  it('asks the struggling question far more than the mastered ones', () => {
    const others = qs.slice(1).map((q) => counts[q.id] ?? 0);
    const meanOthers = others.reduce((a, b) => a + b, 0) / others.length;
    expect(counts['q-0']!).toBeGreaterThan(meanOthers * 3);
  });

  it('still brings every mastered question back at least once', () => {
    for (const q of qs.slice(1)) expect(counts[q.id] ?? 0).toBeGreaterThanOrEqual(1);
  });

  it('brings at least some mastered questions back more than once', () => {
    const repeats = qs.slice(1).filter((q) => (counts[q.id] ?? 0) >= 2).length;
    expect(repeats).toBeGreaterThan(0);
  });
});
