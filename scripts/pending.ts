import { loadBank, loadProgress } from '../lib/store.js';

// Everything the grader needs for questions still awaiting an answer, including the key points.
// Run this at the start of a routine, before assigning anything new.
const bank = loadBank();
const progress = loadProgress(bank);

console.log(
  JSON.stringify(
    {
      dm: progress.dm ?? null,
      pending: progress.pending.map((p) => {
        const q = bank.find((b) => b.id === p.id)!;
        return {
          id: p.id,
          assigned: p.assigned,
          carried: p.carried,
          topic: q.topic,
          prompt: q.prompt,
          keyPoints: q.keyPoints,
          pitfalls: q.pitfalls ?? [],
        };
      }),
    },
    null,
    2,
  ),
);
