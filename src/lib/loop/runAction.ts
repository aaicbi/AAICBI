/**
 * Runs or declines one recorded Loop action. The only place an action's
 * execute() is ever called, whether Loop ran it straight away (the chat's
 * autonomy level allowed it) or the person approved a card.
 */
import { prisma } from "@/lib/prisma";
import { LOOP_ACTION_BY_NAME } from "@/lib/loop/actions";

export interface ActionCard {
  id: string;
  kind: string;
  summary: string;
  risk: string;
  status: "PENDING" | "EXECUTED" | "REJECTED" | "FAILED";
  autoExecuted: boolean;
  result?: unknown;
  error?: string;
}

type Row = {
  id: string;
  kind: string;
  summary: string;
  risk: string;
  status: "PENDING" | "EXECUTED" | "REJECTED" | "FAILED";
  autoExecuted: boolean;
  result: unknown;
};

export function cardOf(row: Row): ActionCard {
  const result = row.result as { error?: string } | null;
  return {
    id: row.id,
    kind: row.kind,
    summary: row.summary,
    risk: row.risk,
    status: row.status,
    autoExecuted: row.autoExecuted,
    ...(row.status === "FAILED" ? { error: result?.error ?? "That didn't work." } : row.result !== null ? { result: row.result } : {}),
  };
}

function notFound() {
  const err = new Error("That action could not be found.") as Error & { status?: number };
  err.status = 404;
  return err;
}

export async function executeLoopAction(id: string, userId: string, opts: { auto: boolean }): Promise<ActionCard> {
  const row = await prisma.loopPendingAction.findFirst({ where: { id, userId } });
  if (!row) throw notFound();
  if (row.status !== "PENDING") return cardOf(row);

  // Claim it exactly once: a double click or two tabs must not run it twice.
  const claimed = await prisma.loopPendingAction.updateMany({ where: { id, status: "PENDING", resolvedAt: null }, data: { resolvedAt: new Date() } });
  if (claimed.count === 0) return cardOf((await prisma.loopPendingAction.findUniqueOrThrow({ where: { id } })) as Row);

  const def = LOOP_ACTION_BY_NAME.get(row.kind);
  let status: "EXECUTED" | "FAILED" = "EXECUTED";
  let result: unknown;
  try {
    if (!def) throw new Error("This kind of action no longer exists.");
    result = await def.execute(row.input as Record<string, unknown>, { userId });
  } catch (e) {
    status = "FAILED";
    result = { error: e instanceof Error ? e.message : "That didn't work." };
    console.error(`Loop action ${row.kind} failed:`, e);
  }
  const updated = await prisma.loopPendingAction.update({
    where: { id },
    data: { status, result: result as object, autoExecuted: opts.auto },
  });
  return cardOf(updated as Row);
}

export async function rejectLoopAction(id: string, userId: string): Promise<ActionCard> {
  const row = await prisma.loopPendingAction.findFirst({ where: { id, userId } });
  if (!row) throw notFound();
  if (row.status !== "PENDING") return cardOf(row as Row);
  await prisma.loopPendingAction.updateMany({ where: { id, status: "PENDING", resolvedAt: null }, data: { status: "REJECTED", resolvedAt: new Date() } });
  return cardOf((await prisma.loopPendingAction.findUniqueOrThrow({ where: { id } })) as Row);
}
