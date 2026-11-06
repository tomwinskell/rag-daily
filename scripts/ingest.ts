import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { todayToronto } from '../lib/schedule.js';
import { loadBank, loadProgress, saveBank, saveProgress, validateBank } from '../lib/store.js';
import type { Question } from '../lib/types.js';

// Adds new questions (from a JSON array in --file) to the bank and stamps lastIngest.
// Run with --date only (no --file) to stamp a scan that found nothing new.
const { values } = parseArgs({
  options: { file: { type: 'string' }, date: { type: 'string' } },
});

const date = values.date ?? todayToronto();
const bank = loadBank();
let added: Question[] = [];

if (values.file) {
  added = JSON.parse(readFileSync(values.file, 'utf8')) as Question[];
  if (!Array.isArray(added)) {
    console.error('--file must contain a JSON array of questions');
    process.exit(1);
  }
  const existing = new Set(bank.map((q) => q.id));
  const clashes = added.filter((q) => existing.has(q.id)).map((q) => q.id);
  if (clashes.length) {
    console.error(`These ids already exist, pick new ones: ${clashes.join(', ')}`);
    process.exit(1);
  }
}

const merged = [...bank, ...added];
const errors = validateBank(merged);
if (errors.length) {
  console.error(`Not ingested, fix these first:\n${errors.join('\n')}`);
  process.exit(1);
}

if (added.length) saveBank(merged);
const progress = loadProgress(merged);
saveProgress({ ...progress, lastIngest: date });
console.log(JSON.stringify({ added: added.map((q) => q.id), bankSize: merged.length, lastIngest: date }));
