import { loadBank, loadProgress, validateBank, validateProgress } from '../lib/store.js';

const bank = loadBank();
const progress = loadProgress(bank);
const errors = [...validateBank(bank), ...validateProgress(progress, bank)];

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const topics = new Set(bank.map((q) => q.topic));
console.log(`OK: ${bank.length} questions across ${topics.size} topics, ${progress.pending.length} pending.`);
