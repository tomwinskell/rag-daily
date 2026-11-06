# Writing and maintaining questions

The bank lives in `bank/questions.json`. Questions come from Tom's study chats, so they should test what he actually studied, in the terms he'll meet again.

## Shape

```json
{
  "id": "emb-007",
  "topic": "embeddings-similarity",
  "tags": ["cosine-vs-dot", "magnitude"],
  "difficulty": 2,
  "kind": "reason",
  "prompt": "What the DM shows.",
  "keyPoints": ["What a strong answer covers", "..."],
  "pitfalls": ["A mistake Tom has actually made on this"],
  "source": "Which chat or session this came from",
  "added": "2026-11-06"
}
```

- `id`: `<prefix>-NNN`, next free number for that prefix, never reused. Reuse an existing prefix for an existing topic.
- `topic`: broad area. Reuse existing topics before inventing one.
- `tags`: 1-3 lowercase-kebab concepts. Weakness is tracked per tag as well as per topic, so reuse tags: that is how a concept Tom keeps missing (e.g. `terminology`, `finetuning-vs-rag`) pulls related questions forward.
- `difficulty`: 1 recall, 2 explain or apply, 3 reason about trade-offs or edge cases.
- `kind`: `recall`, `explain`, `reason`, `code-reading`, `scenario`.

## Writing a good question

- One concept per question. If a prompt needs "and also...", split it.
- Ask for reasoning, not just a definition, wherever the chat did. "Why" and "what goes wrong if" questions expose gaps that recall questions hide.
- The prompt must stand alone, with any code inline, and must not leak the answer.
- 3-5 `keyPoints`, each a checkable statement. They are the grading standard, so keep every one accurate. If you're not sure a claim is true, verify it before it goes in. Don't copy a claim from a chat that was never checked.
- `pitfalls` records slips Tom actually made (loose terminology, a wrong conclusion), so grading and feedback can target them.
- Write in your own words from what the chat covered. Cite the session in `source`.
- Don't add a question that duplicates an existing one. Check `bank/questions.json` first.

## Adding questions

Write a JSON array of new questions to a scratch file outside the repo, then:

```
npm run ingest -- --file <scratch.json>
npm run validate
```

`ingest` refuses duplicate ids and invalid questions, and stamps `lastIngest`.

## Fixing a wrong question

If a key point turns out to be wrong or Tom makes a well-reasoned case against it, edit the question in `bank/questions.json` (keep the id so history stays attached), run `npm run validate`, and mention the fix in the DM.

## Seeds

`bank/seed-attempts.json` records how Tom did in the original tutoring chats, and is only used to build `progress.json` the very first time. Don't edit it afterwards; real answers go through `npm run record`.
