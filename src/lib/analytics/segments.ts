/**
 * Analytics System Phase 3 — a FIXED catalog of segment definitions
 * (not a flexible rule-builder UI), each resolving to a trainee-ID set.
 * Same "named constants over a configurable system" trim applied
 * throughout this project. "Interested in <topic>" segments are the one
 * dynamic part — one per topic with enough trainees to be a real
 * segment, not a single-person curiosity.
 */
import { prisma } from "@/lib/prisma";
import { classifyLifecycle } from "@/lib/analytics/lifecycleCore";
import { computeAllTraineeProfiles, type TraineeInterestProfile } from "@/lib/analytics/interestScoring";

export type FixedSegmentKey =
  | "REGISTERED_NOT_ENROLLED"
  | "STARTED_NOT_COMPLETED"
  | "COMPLETED_AT_LEAST_ONE"
  | "HIGHLY_ENGAGED"
  | "INACTIVE";

const FIXED_SEGMENT_LABEL: Record<FixedSegmentKey, string> = {
  REGISTERED_NOT_ENROLLED: "Registered, not yet enrolled",
  STARTED_NOT_COMPLETED: "Started a course, not completed",
  COMPLETED_AT_LEAST_ONE: "Completed at least one course",
  HIGHLY_ENGAGED: "Highly engaged",
  INACTIVE: "Inactive",
};

export interface SegmentSummary {
  key: string;
  label: string;
  count: number;
}

export interface FixedSegmentResult {
  summaries: SegmentSummary[];
  traineeIdsByKey: Record<FixedSegmentKey, string[]>;
}

export async function getFixedSegments(now: Date = new Date()): Promise<FixedSegmentResult> {
  const [trainees, enrollments] = await Promise.all([
    prisma.trainee.findMany({ select: { id: true, createdAt: true, lastLoginAt: true } }),
    prisma.courseEnrollment.findMany({ select: { traineeId: true, unlockedAt: true, completedAt: true } }),
  ]);

  const byTrainee = new Map<string, { hasUnlocked: boolean; hasCompleted: boolean }>();
  for (const e of enrollments) {
    const entry = byTrainee.get(e.traineeId) ?? { hasUnlocked: false, hasCompleted: false };
    if (e.unlockedAt) entry.hasUnlocked = true;
    if (e.completedAt) entry.hasCompleted = true;
    byTrainee.set(e.traineeId, entry);
  }

  const traineeIdsByKey: Record<FixedSegmentKey, string[]> = {
    REGISTERED_NOT_ENROLLED: [],
    STARTED_NOT_COMPLETED: [],
    COMPLETED_AT_LEAST_ONE: [],
    HIGHLY_ENGAGED: [],
    INACTIVE: [],
  };

  for (const trainee of trainees) {
    const status = byTrainee.get(trainee.id);
    if (!status) {
      traineeIdsByKey.REGISTERED_NOT_ENROLLED.push(trainee.id);
    } else {
      if (status.hasUnlocked && !status.hasCompleted) traineeIdsByKey.STARTED_NOT_COMPLETED.push(trainee.id);
      if (status.hasCompleted) traineeIdsByKey.COMPLETED_AT_LEAST_ONE.push(trainee.id);
    }
    const tag = classifyLifecycle(trainee, status?.hasCompleted ?? false, now);
    if (tag === "ACTIVE") traineeIdsByKey.HIGHLY_ENGAGED.push(trainee.id);
    if (tag === "INACTIVE") traineeIdsByKey.INACTIVE.push(trainee.id);
  }

  const summaries = (Object.keys(traineeIdsByKey) as FixedSegmentKey[]).map((key) => ({
    key,
    label: FIXED_SEGMENT_LABEL[key],
    count: traineeIdsByKey[key].length,
  }));

  return { summaries, traineeIdsByKey };
}

const MIN_TRAINEES_FOR_INTEREST_SEGMENT = 2;
export const INTEREST_SEGMENT_PREFIX = "INTERESTED_IN:";

export interface InterestSegmentResult {
  summaries: SegmentSummary[];
  traineeIdsByKey: Record<string, string[]>;
}

export async function getInterestSegments(precomputedProfiles?: Map<string, TraineeInterestProfile>): Promise<InterestSegmentResult> {
  const profiles = precomputedProfiles ?? (await computeAllTraineeProfiles());
  const byTopic = new Map<string, string[]>();

  for (const [traineeId, profile] of profiles) {
    for (const topic of [profile.primary, ...profile.secondary].filter((t): t is string => t !== null)) {
      const list = byTopic.get(topic) ?? [];
      list.push(traineeId);
      byTopic.set(topic, list);
    }
  }

  const summaries: SegmentSummary[] = [];
  const traineeIdsByKey: Record<string, string[]> = {};
  for (const [topic, ids] of byTopic) {
    if (ids.length < MIN_TRAINEES_FOR_INTEREST_SEGMENT) continue;
    const key = `${INTEREST_SEGMENT_PREFIX}${topic}`;
    summaries.push({ key, label: `Interested in ${topic}`, count: ids.length });
    traineeIdsByKey[key] = ids;
  }
  summaries.sort((a, b) => b.count - a.count);
  return { summaries, traineeIdsByKey };
}

/** Resolves any segment key (fixed or dynamic "Interested in") to its trainee-ID set, or null if unknown. */
export async function resolveSegmentTraineeIds(segmentKey: string): Promise<string[] | null> {
  if (segmentKey.startsWith(INTEREST_SEGMENT_PREFIX)) {
    const { traineeIdsByKey } = await getInterestSegments();
    return traineeIdsByKey[segmentKey] ?? null;
  }
  const { traineeIdsByKey } = await getFixedSegments();
  return (traineeIdsByKey as Record<string, string[]>)[segmentKey] ?? null;
}
