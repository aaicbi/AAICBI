/**
 * How much Loop may do on its own. A chat has an autonomy level, picked like a
 * model in Claude:
 *   1  Ask first   — every change waits for the person's approval.
 *   2  Balanced    — low-risk changes happen at once; risky ones ask.
 *   3  Autonomous  — changes happen at once, except those marked
 *                    "always confirm" (a message to a large audience).
 * Reading and thinking are never limited by the level.
 */
export type LoopLevel = 1 | 2 | 3;
export type ActionRisk = "low" | "high";

export const LOOP_LEVELS: { level: LoopLevel; name: string; description: string }[] = [
  { level: 1, name: "Ask first", description: "Loop asks you to approve every change before it happens." },
  { level: 2, name: "Balanced", description: "Loop makes low-risk changes itself (drafts, settings) and asks before messaging people or affecting accounts." },
  { level: 3, name: "Autonomous", description: "Loop makes changes itself. A message to a large audience is still confirmed." },
];

export const DEFAULT_LOOP_LEVEL: LoopLevel = 1;

/** A message to more people than this is always confirmed, even at level 3. */
export const BROADCAST_CONFIRM_THRESHOLD = 25;

export function clampLevel(value: unknown): LoopLevel {
  const n = typeof value === "number" ? Math.round(value) : Number(value);
  return n === 2 ? 2 : n === 3 ? 3 : 1;
}

export function decideExecution(args: { level: LoopLevel; risk: ActionRisk; alwaysConfirm?: boolean }): "ask" | "run" {
  if (args.alwaysConfirm) return "ask";
  if (args.level === 1) return "ask";
  if (args.level === 2) return args.risk === "high" ? "ask" : "run";
  return "run";
}

/** A short title for a conversation, from the first thing said. */
export function titleFromMessage(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (!oneLine) return "New chat";
  return oneLine.length <= 48 ? oneLine : `${oneLine.slice(0, 45).trimEnd()}…`;
}
