export type Grade = 0 | 1 | 2 | 3;

export type QuestionKind = 'recall' | 'explain' | 'reason' | 'code-reading' | 'scenario';

export interface Question {
  /** Stable id, `<prefix>-NNN`. Never reused. */
  id: string;
  /** Broad area, e.g. "embeddings-similarity". */
  topic: string;
  /** Fine-grained concepts, lowercase-kebab. Weakness is tracked per tag as well as per topic. */
  tags: string[];
  difficulty: 1 | 2 | 3;
  kind: QuestionKind;
  /** What Tom sees. Must not leak the answer. */
  prompt: string;
  /** What a strong answer covers. Used for grading only, never shown before the answer. */
  keyPoints: string[];
  /** Mistakes Tom has actually made (or likely will) on this concept. Grading only. */
  pitfalls?: string[];
  /** Which chat/session this came from. */
  source: string;
  /** YYYY-MM-DD the question entered the bank. */
  added: string;
}

export interface Attempt {
  date: string;
  grade: Grade;
  /** `chat-seed` = inferred from the original tutoring chats; `daily` = graded from a Slack reply. */
  origin: 'chat-seed' | 'daily';
  note?: string;
}

export interface QState {
  attempts: Attempt[];
  /** Leitner box, 0 (struggling) to MAX_BOX (mastered). */
  box: number;
  lastAsked?: string;
  nextDue?: string;
}

export interface Pending {
  id: string;
  /** Date it was first assigned. */
  assigned: string;
  /** How many extra days it has been carried over unanswered. */
  carried: number;
}

export interface HistoryEntry {
  date: string;
  ids: string[];
  /** Questions dropped after going unanswered (no penalty). */
  skipped?: string[];
}

export interface Progress {
  version: 1;
  questions: Record<string, QState>;
  pending: Pending[];
  /** Slack DM for the latest assignment, so the next run can read the thread. */
  dm?: { channel: string; ts: string; date: string };
  /** Date project chats were last scanned for new material. */
  lastIngest?: string;
  history: HistoryEntry[];
}

export interface SeedAttempt {
  id: string;
  grade: Grade;
  note: string;
}
