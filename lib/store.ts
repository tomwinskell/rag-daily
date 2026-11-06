import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyGrade, emptyState } from './schedule.js';
import type { Progress, Question, SeedAttempt } from './types.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BANK_PATH = path.join(root, 'bank', 'questions.json');
export const SEED_PATH = path.join(root, 'bank', 'seed-attempts.json');
export const PROGRESS_PATH = path.join(root, 'progress.json');

export function loadBank(): Question[] {
  return JSON.parse(readFileSync(BANK_PATH, 'utf8')) as Question[];
}

export function saveBank(questions: Question[]): void {
  writeFileSync(BANK_PATH, `${JSON.stringify(questions, null, 2)}\n`);
}

/**
 * Loads progress.json. On the very first run it is built from bank/seed-attempts.json, which
 * records how Tom actually did in the original tutoring chats. Questions added to the bank
 * later get an empty state here, so new material needs no migration.
 */
export function loadProgress(questions: Question[]): Progress {
  let progress: Progress;
  if (existsSync(PROGRESS_PATH)) {
    progress = JSON.parse(readFileSync(PROGRESS_PATH, 'utf8')) as Progress;
  } else {
    progress = { version: 1, questions: {}, pending: [], history: [] };
    const seeds = JSON.parse(readFileSync(SEED_PATH, 'utf8')) as {
      date: string;
      attempts: SeedAttempt[];
    };
    for (const s of seeds.attempts) {
      progress.questions[s.id] = applyGrade(
        progress.questions[s.id] ?? emptyState(),
        s.grade,
        seeds.date,
        'chat-seed',
        s.note,
      );
    }
  }
  for (const q of questions) {
    if (!progress.questions[q.id]) progress.questions[q.id] = emptyState();
  }
  return progress;
}

export function saveProgress(progress: Progress): void {
  writeFileSync(PROGRESS_PATH, `${JSON.stringify(progress, null, 2)}\n`);
}

export function validateBank(questions: Question[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const q of questions) {
    const where = q.id ?? '(no id)';
    if (!q.id || !/^[a-z]+-\d{3}$/.test(q.id)) errors.push(`${where}: id must look like "abc-001"`);
    if (seen.has(q.id)) errors.push(`${where}: duplicate id`);
    seen.add(q.id);
    if (!q.topic) errors.push(`${where}: missing topic`);
    if (!Array.isArray(q.tags) || q.tags.length === 0) errors.push(`${where}: needs at least one tag`);
    else if (q.tags.some((t) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t)))
      errors.push(`${where}: tags must be lowercase-kebab`);
    if (![1, 2, 3].includes(q.difficulty)) errors.push(`${where}: difficulty must be 1, 2 or 3`);
    if (!['recall', 'explain', 'reason', 'code-reading', 'scenario'].includes(q.kind))
      errors.push(`${where}: unknown kind "${q.kind}"`);
    if (!q.prompt || q.prompt.trim().length < 15) errors.push(`${where}: prompt too short`);
    if (!Array.isArray(q.keyPoints) || q.keyPoints.length < 2)
      errors.push(`${where}: needs at least 2 keyPoints`);
    if (!q.source) errors.push(`${where}: missing source`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(q.added ?? '')) errors.push(`${where}: added must be YYYY-MM-DD`);
  }
  return errors;
}

export function validateProgress(progress: Progress, questions: Question[]): string[] {
  const errors: string[] = [];
  const known = new Set(questions.map((q) => q.id));
  for (const id of Object.keys(progress.questions)) {
    if (!known.has(id)) errors.push(`progress has state for unknown question ${id}`);
  }
  for (const p of progress.pending) {
    if (!known.has(p.id)) errors.push(`pending references unknown question ${p.id}`);
  }
  return errors;
}
