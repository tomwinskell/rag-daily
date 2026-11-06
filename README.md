# rag-daily

A daily spaced-repetition quiz built from my RAG study chats. A scheduled Claude task DMs me 1-2 questions each morning, grades my Slack replies the next day, and shifts the mix toward whatever I keep getting wrong.

## How it works

- `bank/questions.json`: the question bank, written from the chats in the "RAG fundamentals" project. It grows as new chats are added.
- `progress.json`: every answer ever graded, plus what's pending. This is the only memory between runs.
- Each question sits in a Leitner box (0-5). A miss sends it to box 0 and it comes back the next day. Good answers move it up and push the next review out (1, 2, 4, 8, 16, 30 days). Mastered questions never leave: they keep a small weight and resurface occasionally.
- Weakness is also tracked per concept tag and per topic, with recent answers counting more. A shaky concept pulls its sibling questions forward, not just the one I missed.
- The first slot each day is a due review whenever something is due. The second is a weighted draw across everything, including new material.
- Unanswered questions carry over once, then drop with no penalty.
- A question I miss three times running is flagged as a leech and gets rephrased or split into a smaller prerequisite instead of being asked verbatim again.

`ROUTINE.md` is what the scheduled task follows. `AUTHORING.md` covers writing questions and the grading rubric.

## Commands

```
npm run next [-- --assign] [-- --count 1] [-- --explain]   preview or assign today's questions
npm run pending                                            pending questions with key points (for grading)
npm run record -- --id <id> --grade <0-3> --note "..."     log a graded answer
npm run dm -- --channel <id> --ts <ts>                     remember which Slack message holds today's quiz
npm run ingest -- --file new.json                          add questions to the bank
npm run stats [-- --json]                                  mastery by topic and concept
npm run validate                                           check bank and progress
npm test                                                   scheduling tests, including a 60-day simulation
```

## Answering

Reply in the Slack thread under the morning DM, in your own words. "I don't know what X means" is a fine answer and better than guessing. Feedback and the right answers arrive in the next morning's DM.
