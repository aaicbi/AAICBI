/**
 * Analytics System Phase 2 — the single write path for `VisitorEvent`,
 * called only from POST /api/analytics/visitor-event. Mirrors
 * track.ts's never-throws discipline and prune-on-write retention.
 */
import { prisma } from "@/lib/prisma";
import { getConsentDecision, getVisitorId } from "@/lib/analytics/visitorCookies";
import { categorizeReferrer, categorizeDevice, isLikelyBot } from "@/lib/analytics/visitorCategorizationCore";

export type VisitorEventType = "PAGE_VIEWED" | "COURSE_VIEWED" | "REGISTER_CLICKED" | "SEARCH_PERFORMED";

const MAX_SEARCH_QUERY_LENGTH = 200;

export interface TrackVisitorEventInput {
  type: VisitorEventType;
  path?: string | null;
  courseId?: string | null;
  referrerHostname?: string | null;
  utmSource?: string | null;
  userAgent?: string | null;
  // Phase 3 — SEARCH_PERFORMED only. See VisitorEvent's own schema
  // comment on why searchQuery is the one column on this model allowed
  // to carry real free text.
  searchQuery?: string | null;
  resultCount?: number | null;
}

/**
 * Returns true if an event was actually recorded, false for every
 * no-op case (consent not accepted, no visitor-id cookie present yet,
 * or a known crawler/script — see isLikelyBot). Never throws.
 */
export async function trackVisitorEvent(input: TrackVisitorEventInput): Promise<boolean> {
  if (getConsentDecision() !== "accepted") return false;
  const visitorId = getVisitorId();
  if (!visitorId) return false;
  // Analytics System Phase 5 — a crawler/script never counts as a
  // "visitor" at all, same silent no-op treatment as declined consent,
  // not a new error path.
  if (isLikelyBot(input.userAgent)) return false;

  try {
    await prisma.visitorEvent.create({
      data: {
        visitorId,
        type: input.type,
        path: input.path ?? undefined,
        courseId: input.courseId ?? undefined,
        referrerSource: categorizeReferrer(input.referrerHostname ?? null, input.utmSource ?? null),
        deviceCategory: input.userAgent ? categorizeDevice(input.userAgent) : undefined,
        searchQuery: input.searchQuery ? input.searchQuery.trim().slice(0, MAX_SEARCH_QUERY_LENGTH) : undefined,
        resultCount: input.resultCount ?? undefined,
      },
    });
  } catch (e) {
    console.error(`Failed to record visitor event ${input.type}:`, e);
    return false;
  }
  await maybePruneOldVisitorEvents();
  return true;
}

// Same probabilistic prune-on-write retention as track.ts's
// maybePruneOldEvents and notifications/log.ts's maybePruneOldLogs.
const RETENTION_DAYS = 180;
const PRUNE_PROBABILITY = 0.005;

async function maybePruneOldVisitorEvents(): Promise<void> {
  if (Math.random() >= PRUNE_PROBABILITY) return;
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    await prisma.visitorEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
  } catch (e) {
    console.error("VisitorEvent pruning failed (non-fatal, will retry on a later write):", e);
  }
}
