import { prisma } from "@/lib/prisma";

export interface AuditInput {
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  organizationId?: string | null;
  outcome?: "OK" | "DENIED" | "FAILED";
  reason?: string | null;
  before?: unknown;
  after?: unknown;
}

const clip = (v: string | null | undefined, n: number) => (v ? v.slice(0, n) : null);

/**
 * Records a sensitive event. Best effort: a failure to write the record never breaks the action that caused it. Callers pass identifiers,
 * permission keys and short reasons only: never passwords, tokens or message text.
 */
export async function recordAudit(e: AuditInput): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        actorId: e.actorId ?? null, actorRole: e.actorRole ?? null, action: e.action.slice(0, 80), resourceType: clip(e.resourceType, 60), resourceId: clip(e.resourceId, 80),
        organizationId: e.organizationId ?? null, outcome: e.outcome ?? "OK", reason: clip(e.reason, 500),
        before: (e.before ?? undefined) as never, after: (e.after ?? undefined) as never,
      },
    });
  } catch (err) {
    console.error("Could not record an audit event:", err instanceof Error ? err.message : err);
  }
}
