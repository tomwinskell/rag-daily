import { parseArgs } from 'node:util';
import { assign, boxLabel, conceptWeakness, isLeech, todayToronto, weightOf } from '../lib/schedule.js';
import { loadBank, loadProgress, saveProgress, validateBank } from '../lib/store.js';

const { values } = parseArgs({
  options: {
    assign: { type: 'boolean', default: false },
    count: { type: 'string', default: '2' },
    date: { type: 'string' },
    explain: { type: 'boolean', default: false },
  },
});

const today = values.date ?? todayToronto();
const count = Math.min(2, Math.max(1, Number.parseInt(values.count ?? '2', 10) || 2));
const bank = loadBank();
const errors = validateBank(bank);
if (errors.length) {
  console.error(`Bank is invalid:\n${errors.join('\n')}`);
  process.exit(1);
}

const progress = loadProgress(bank);
const result = assign(progress, bank, today, count);
if (values.assign) saveProgress(result.progress);

const view = (id: string) => {
  const q = bank.find((b) => b.id === id)!;
  const st = result.progress.questions[id];
  const lastGrade = st?.attempts.at(-1)?.grade ?? null;
  return {
    id,
    topic: q.topic,
    tags: q.tags,
    difficulty: q.difficulty,
    kind: q.kind,
    // keyPoints and pitfalls are deliberately left out so they can't leak into the DM.
    prompt: q.prompt,
    carriedOver: result.carried.includes(id),
    timesAsked: st?.attempts.length ?? 0,
    lastGrade,
    status: boxLabel(st?.box ?? 0, st?.attempts.length ?? 0),
    // True after three weak answers in a row: rephrase or split it instead of re-asking verbatim.
    leech: st ? isLeech(st) : false,
  };
};

const out: Record<string, unknown> = {
  date: today,
  mode: values.assign ? 'assigned' : 'preview (nothing saved)',
  alreadyAssignedToday: result.ids.length > 0 && result.fresh.length === 0 && result.carried.length === 0,
  assigned: result.ids.map(view),
  skippedUnanswered: result.skipped,
  bankSize: bank.length,
};

if (values.explain) {
  out.weights = bank
    .map((q) => ({
      id: q.id,
      weight: Number(weightOf(q, bank, progress, today).toFixed(3)),
      conceptWeakness: Number(conceptWeakness(q, bank, progress, today).toFixed(2)),
      box: progress.questions[q.id]?.box ?? 0,
    }))
    .sort((a, b) => b.weight - a.weight);
}

console.log(JSON.stringify(out, null, 2));
