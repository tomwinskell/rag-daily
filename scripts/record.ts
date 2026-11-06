import { parseArgs } from 'node:util';
import { record, todayToronto } from '../lib/schedule.js';
import { loadBank, loadProgress, saveProgress } from '../lib/store.js';
import type { Grade } from '../lib/types.js';

const { values } = parseArgs({
  options: {
    id: { type: 'string' },
    grade: { type: 'string' },
    note: { type: 'string' },
    date: { type: 'string' },
  },
});

const grade = Number(values.grade);
if (!values.id || ![0, 1, 2, 3].includes(grade)) {
  console.error('Usage: npm run record -- --id <question-id> --grade <0-3> [--note "<what was missed>"] [--date YYYY-MM-DD]');
  process.exit(1);
}

const bank = loadBank();
if (!bank.some((q) => q.id === values.id)) {
  console.error(`Unknown question id: ${values.id}`);
  process.exit(1);
}

const progress = loadProgress(bank);
const wasPending = progress.pending.some((p) => p.id === values.id);
const next = record(progress, values.id, grade as Grade, values.date ?? todayToronto(), values.note);
saveProgress(next);

const st = next.questions[values.id]!;
console.log(
  JSON.stringify({
    recorded: values.id,
    grade,
    wasPending,
    box: st.box,
    nextDue: st.nextDue,
  }),
);
