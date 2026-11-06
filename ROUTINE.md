# Daily routine

This is what the scheduled Claude task follows every morning. `progress.json` is the only memory between runs, so read the repo state first and commit it last. Nobody is watching the session: don't ask questions, make the most reasonable choice, and report problems in the Slack DM and the final output.

All dates are Toronto dates; the scripts already use them. Tom's Slack user ID is `U09PJ2HUBKL` (the DM goes to himself).

## 1. Sync

If `/home/claude/rag-daily` doesn't exist, attach the repo with `add_repo` (owner `tomwinskell`, repo `rag-daily`, access `push`), then do one `git clone`. Otherwise `git pull --ff-only`. Run `npm ci` if `node_modules` is missing.

## 2. Grade yesterday's answers

```
npm run pending
```

If `pending` is empty, skip to step 3. Otherwise the JSON has `dm: { channel, ts, date }` and each pending question with its `keyPoints` and `pitfalls`.

1. Read Tom's replies with `slack_read_thread` (`channel_id` = `dm.channel`, `message_ts` = `dm.ts`). Every reply in that thread is an answer. If the thread is empty, also check the channel with `slack_read_channel` for messages after `dm.ts`. If `dm` is null or there are no replies, grade nothing.
2. Match each reply to a question (he may number them or name the topic). For each answered question, grade it 0-3 against its `keyPoints` and record it:

   ```
   npm run record -- --id <id> --grade <0-3> --note "<one line: what he got and what he missed>"
   ```

3. Don't record anything for a question he didn't answer. The scheduler carries it over once, then drops it with no penalty, because silence isn't a wrong answer.
4. Never post into the thread. The DM is sent from Tom's own account, so anything you post there would be read as one of his answers tomorrow. Feedback goes in the next DM (step 5).

### Grading rubric

Strict but friendly. Judge the substance, not the wording: equivalent phrasing is fine, and a correct point that isn't on the list isn't penalised (check it's actually true).

| Grade | Meaning |
| --- | --- |
| 3 | Correct and precise. Covers the key points with the right terminology. |
| 2 | Core idea right, with a minor gap or a loose term. |
| 1 | Partly right. Missed a key point, or has a real misconception next to correct ideas. |
| 0 | Wrong, or no real attempt. |

- Terminology that is loose enough to change the meaning (e.g. calling fine-tuning "prompt tweaking") caps the grade at 1 even if the surrounding reasoning is good.
- If he says "I don't know what X means" instead of guessing, grade 0, and say in the feedback that this was the right move. Asking for the definition is what we want.
- If a reply contradicts a key point but he gives a reason, check the reason. If he's right, say so and fix the bank (see AUTHORING.md).

## 3. Pull in new material from the project chats (best effort)

The bank grows from Tom's study chats in the "RAG fundamentals" project.

1. Check `npm run -s stats -- --json` for `lastIngest`.
2. If chat tools are available (`recent_chats`, `conversation_search`, `read_conversation`), list chats updated after `lastIngest` and open each one once. Look for concepts that aren't already in `bank/questions.json`, and for terms or ideas Tom got wrong that deserve their own question.
3. Write up to 5 new questions to a scratch file following AUTHORING.md, then:

   ```
   npm run ingest -- --file <scratch.json>
   ```

   If the scan found nothing new, run `npm run ingest` with no `--file` to stamp the scan date.
4. If the chat tools are missing, or they return nothing from the RAG project (searches can be scoped to where the task runs), skip this step. Don't stamp `lastIngest`, and note it in the final output. If `lastIngest` is more than 7 days old, add one line to the DM saying new chats couldn't be read and that "update the quiz bank" in any project chat will refresh it.

## 4. Assign today's questions

```
npm run next -- --assign
```

This picks 1-2 questions (default 2) and saves them as pending. The first slot is always a due review when anything is due, so weak material gets daily attention. The second slot is a weighted draw over everything else, including new material and a small trickle of mastered questions. If a question was carried over unanswered, it keeps its slot.

The JSON deliberately excludes `keyPoints` and `pitfalls`. Never include hints or answers for today's questions in the DM.

If an assigned question has `leech: true` (three weak answers in a row), asking it verbatim again isn't helping. Rephrase it as a new question, or split out the prerequisite concept as a smaller question (new id via `npm run ingest`), and offer in the DM to work through that concept in a chat in the project.

## 5. Send the DM

Use `slack_send_message` with `channel_id` `U09PJ2HUBKL`. Casual but measured, direct and concise, no internet slang. Shape:

```
*Daily RAG quiz: <Weekday, Mon D>*

*Yesterday*   (only if you graded something)
• <topic>: <Solid | Good | Partial | Missed>. <1-2 sentences: what was right, what was missed, the key point in plain words>

*Today*
1. <prompt>  _(<topic>, <difficulty>)_   [add "(from yesterday)" if carried over]
2. <prompt>

Reply in this thread, in your own words. "I don't know what X means" is a fine answer.
<summary line from `npm run -s stats`>
```

Feedback on yesterday's answers is where the learning happens, so give the right answer plainly for anything graded below 3. Keep the whole message short.

Right after sending, store where it went (use the channel id and ts exactly as the send result returns them):

```
npm run dm -- --channel <channel> --ts <ts>
```

## 6. Commit and push

Stage only `progress.json` and, if step 3 added questions, `bank/questions.json`. Commit message: `Quiz <date>: <ids>`. Push to `main`. If the push is rejected, `git pull --rebase` once and push again; if it still fails, don't loop, report it in the final output.

## 7. Final output

One or two sentences: which questions went out, how many answers were graded, whether new material was ingested, whether the push and the DM succeeded.
