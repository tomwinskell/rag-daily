import { parseArgs } from 'node:util';
import { loadBank, loadProgress, saveProgress } from '../lib/store.js';

const { values } = parseArgs({
  options: {
    channel: { type: 'string' },
    ts: { type: 'string' },
  },
});

if (!values.channel || !values.ts) {
  console.error('Usage: npm run dm -- --channel <channel id from the send result> --ts <message ts>');
  process.exit(1);
}

const bank = loadBank();
const progress = loadProgress(bank);
const date = progress.history.at(-1)?.date;
if (!date) {
  console.error('Nothing has been assigned yet; run `npm run next -- --assign` first.');
  process.exit(1);
}

saveProgress({ ...progress, dm: { channel: values.channel, ts: values.ts, date } });
console.log(JSON.stringify({ saved: true, channel: values.channel, ts: values.ts, date }));
