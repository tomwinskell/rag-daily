import { parseArgs } from 'node:util';
import { addDays, boxLabel, isLeech, todayToronto, weaknessOf } from '../lib/schedule.js';
import { loadBank, loadProgress } from '../lib/store.js';
import type { Attempt } from '../lib/types.js';

const { values } = parseArgs({
  options: { json: { type: 'boolean', default: false }, date: { type: 'string' } },
});

const today = values.date ?? todayToronto();
const bank = loadBank();
const progress = loadProgress(bank);

// Status counts
const status: Record<string, number> = { new: 0, struggling: 0, improving: 0, solid: 0, mastered: 0 };
for (const q of bank) {
  const st = progress.questions[q.id]!;
  const label = boxLabel(st.box, st.attempts.length);
  status[label] = (status[label] ?? 0) + 1;
}

// Streak: consecutive days with at least one graded daily answer, ending today or yesterday.
const answeredDays = new Set<string>();
for (const st of Object.values(progress.questions)) {
  for (const a of st.attempts) if (a.origin === 'daily') answeredDays.add(a.date);
}
let streak = 0;
let cursor = answeredDays.has(today) ? today : addDays(today, -1);
while (answeredDays.has(cursor)) {
  streak++;
  cursor = addDays(cursor, -1);
}

// Per-topic and per-tag weakness
const pool = (keyOf: (q: (typeof bank)[number]) => string[]) => {
  const groups = new Map<string, Attempt[]>();
  for (const q of bank) {
    for (const key of keyOf(q)) {
      const list = groups.get(key) ?? [];
      list.push(...(progress.questions[q.id]?.attempts ?? []));
      groups.set(key, list);
    }
  }
  return [...groups.entries()]
    .filter(([, attempts]) => attempts.length > 0)
    .map(([name, attempts]) => ({
      name,
      attempts: attempts.length,
      avgGrade: Number((attempts.reduce((s, a) => s + a.grade, 0) / attempts.length).toFixed(2)),
      weakness: Number(weaknessOf(attempts, today).toFixed(2)),
    }))
    .sort((a, b) => b.weakness - a.weakness);
};

const topics = pool((q) => [q.topic]);
const tags = pool((q) => q.tags);
const weakest = tags.slice(0, 3);

const answeredEver = bank.filter((q) => (progress.questions[q.id]?.attempts.length ?? 0) > 0).length;
const summary =
  `${answeredEver}/${bank.length} questions seen, ${status.mastered} mastered, ` +
  `${status.struggling} struggling, streak ${streak} day${streak === 1 ? '' : 's'}` +
  (weakest.length ? `. Weakest right now: ${weakest.map((w) => w.name).join(', ')}.` : '.');

const leeches = bank.filter((q) => isLeech(progress.questions[q.id]!)).map((q) => q.id);

const out = {
  date: today,
  summary,
  leeches,
  bankSize: bank.length,
  status,
  streak,
  pending: progress.pending.length,
  topics,
  weakestTags: weakest,
  lastIngest: progress.lastIngest ?? null,
};

if (values.json) console.log(JSON.stringify(out, null, 2));
else {
  console.log(summary);
  console.log('');
  console.log('Topics (weakest first):');
  for (const t of topics) console.log(`  ${t.name.padEnd(28)} avg ${t.avgGrade}  weakness ${t.weakness}  (${t.attempts} attempts)`);
  console.log('');
  console.log('Concept tags (weakest first):');
  for (const t of tags.slice(0, 8)) console.log(`  ${t.name.padEnd(28)} avg ${t.avgGrade}  weakness ${t.weakness}  (${t.attempts} attempts)`);
}
