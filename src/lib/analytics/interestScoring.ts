/**
 * Analytics System Phase 3 — gathers the raw signals behind a trainee's
 * (or the whole platform's) interest profile and hands them to
 * interestCore.ts's pure scoring functions. `Course.category` is used
 * AS-IS as the "topic" — whatever text an admin typed — falling back to
 * the course's own title when category is null, so a course never
 * silently drops out of scoring. See this file's own weight constants
 * for the full signal-to-weight mapping; they're simple named
 * constants, not an admin-configurable weight-tuning system, matching
 * this project's established "named constants over a config system"
 * precedent (see lifecycleCore.ts's thresholds).
 */
import { prisma } from "@/lib/prisma";
import { computeDecayedWeight, computeConfidencePercent, classifyInterests, type TopicScore } from "@/lib/analytics/interestCore";

const HALF_LIFE_DAYS = 60;
const SATURATION_CONSTANT = 20;
const EMERGING_WINDOW_DAYS = 30;

// Raw per-signal weights — see this file's own header comment on why
// these are fixed constants.
const WEIGHT = {
  COURSE_VIEWED: 1,
  LESSON_COMPLETED: 5,
  ASSESSMENT_STARTED: 8,
  ASSESSMENT_COMPLETED: 12,
  ENROLLED: 15,
  COMPLETED: 25,
  ANONYMOUS_VIEW: 0.5,
} as const;

interface RawSignal {
  topic: string;
  weight: number;
  occurredAt: Date;
}

export interface TopicEvidence {
  topic: string;
  confidencePercent: number;
  // Human-readable counts behind the score, e.g. "Viewed 3 times,
  // completed 2 lessons" — the master spec's own Section 9 requirement
  // that an admin can always see WHY a topic was classified this way.
  counts: Record<string, number>;
}

export interface TraineeInterestProfile {
  primary: string | null;
  secondary: string[];
  emerging: string[];
  topics: TopicEvidence[];
}

async function gatherTraineeSignals(traineeId: string, now: Date): Promise<{ signals: RawSignal[]; rawCounts: Map<string, Record<string, number>> }> {
  const signals: RawSignal[] = [];
  const rawCounts = new Map<string, Record<string, number>>();

  function bump(topic: string, key: string) {
    const counts = rawCounts.get(topic) ?? {};
    counts[key] = (counts[key] ?? 0) + 1;
    rawCounts.set(topic, counts);
  }

  // Course -> topic lookup, built once from every course this trainee
  // has ANY signal against, rather than one query per event.
  const [events, enrollments, trainee] = await Promise.all([
    prisma.analyticsEvent.findMany({
      where: {
        userId: traineeId,
        recipientType: "TRAINEE",
        type: { in: ["COURSE_VIEWED", "LESSON_COMPLETED", "ASSESSMENT_STARTED", "ASSESSMENT_COMPLETED"] },
        courseId: { not: null },
      },
      select: { type: true, courseId: true, createdAt: true },
    }),
    prisma.courseEnrollment.findMany({
      where: { traineeId },
      select: { courseId: true, enrolledAt: true, completedAt: true },
    }),
    prisma.trainee.findUnique({ where: { id: traineeId }, select: { registrationVisitorId: true, createdAt: true } }),
  ]);

  const courseIds = new Set<string>([
    ...events.map((e) => e.courseId!),
    ...enrollments.map((e) => e.courseId),
  ]);

  let anonymousEvents: { courseId: string | null; createdAt: Date }[] = [];
  if (trainee?.registrationVisitorId) {
    anonymousEvents = await prisma.visitorEvent.findMany({
      where: { visitorId: trainee.registrationVisitorId, type: "COURSE_VIEWED", courseId: { not: null } },
      select: { courseId: true, createdAt: true },
    });
    anonymousEvents.forEach((e) => courseIds.add(e.courseId!));
  }

  const courses = await prisma.course.findMany({
    where: { id: { in: [...courseIds] } },
    select: { id: true, title: true, category: true },
  });
  const topicByCourseId = new Map(courses.map((c) => [c.id, c.category?.trim() || c.title]));

  for (const event of events) {
    const topic = topicByCourseId.get(event.courseId!);
    if (!topic) continue;
    signals.push({ topic, weight: WEIGHT[event.type as keyof typeof WEIGHT], occurredAt: event.createdAt });
    bump(topic, event.type === "COURSE_VIEWED" ? "views" : event.type === "LESSON_COMPLETED" ? "lessonsCompleted" : event.type === "ASSESSMENT_STARTED" ? "assessmentsStarted" : "assessmentsCompleted");
  }
  for (const enrollment of enrollments) {
    const topic = topicByCourseId.get(enrollment.courseId);
    if (!topic) continue;
    signals.push({ topic, weight: WEIGHT.ENROLLED, occurredAt: enrollment.enrolledAt });
    bump(topic, "enrolled");
    if (enrollment.completedAt) {
      signals.push({ topic, weight: WEIGHT.COMPLETED, occurredAt: enrollment.completedAt });
      bump(topic, "completed");
    }
  }
  for (const anon of anonymousEvents) {
    const topic = topicByCourseId.get(anon.courseId!);
    if (!topic) continue;
    signals.push({ topic, weight: WEIGHT.ANONYMOUS_VIEW, occurredAt: anon.createdAt });
    bump(topic, "anonymousViews");
  }

  return { signals, rawCounts };
}

function scoreSignals(signals: RawSignal[], rawCounts: Map<string, Record<string, number>>, now: Date): TraineeInterestProfile {
  const byTopic = new Map<string, RawSignal[]>();
  for (const s of signals) {
    const list = byTopic.get(s.topic) ?? [];
    list.push(s);
    byTopic.set(s.topic, list);
  }

  const topicScoresForClassification: TopicScore[] = [];
  const evidence: TopicEvidence[] = [];

  for (const [topic, topicSignals] of byTopic) {
    let total = 0;
    let allRecent = true;
    for (const s of topicSignals) {
      const daysAgo = (now.getTime() - s.occurredAt.getTime()) / (24 * 60 * 60 * 1000);
      total += computeDecayedWeight(s.weight, daysAgo, HALF_LIFE_DAYS);
      if (daysAgo > EMERGING_WINDOW_DAYS) allRecent = false;
    }
    const confidencePercent = computeConfidencePercent(total, SATURATION_CONSTANT);
    topicScoresForClassification.push({ topic, confidencePercent, allEvidenceRecent: allRecent });
    evidence.push({ topic, confidencePercent, counts: rawCounts.get(topic) ?? {} });
  }

  evidence.sort((a, b) => b.confidencePercent - a.confidencePercent);
  const classification = classifyInterests(topicScoresForClassification);

  return { ...classification, topics: evidence };
}

export async function getTraineeInterestProfile(traineeId: string, now: Date = new Date()): Promise<TraineeInterestProfile> {
  const { signals, rawCounts } = await gatherTraineeSignals(traineeId, now);
  return scoreSignals(signals, rawCounts, now);
}

export interface PlatformInterestSummary {
  topTopics: { topic: string; traineeCount: number }[];
  emergingTopics: { topic: string; traineeCount: number }[];
}

/**
 * Computes every trainee's profile ONCE — the shared, expensive step
 * behind both getPlatformInterestSummary and segments.ts's
 * getInterestSegments, which would otherwise each redo this same
 * N-trainee pass independently. Callers that need both should compute
 * this once and pass it to each, rather than calling either function
 * with no argument twice. Fine to compute synchronously at this
 * platform's real trainee count; see this file's own header comment /
 * the Phase 3 plan for when to revisit (a precomputed table, only if
 * that count grows into the thousands).
 */
export async function computeAllTraineeProfiles(now: Date = new Date()): Promise<Map<string, TraineeInterestProfile>> {
  const trainees = await prisma.trainee.findMany({ select: { id: true } });
  const profiles = new Map<string, TraineeInterestProfile>();
  for (const trainee of trainees) {
    profiles.set(trainee.id, await getTraineeInterestProfile(trainee.id, now));
  }
  return profiles;
}

export async function getPlatformInterestSummary(
  now: Date = new Date(),
  precomputedProfiles?: Map<string, TraineeInterestProfile>
): Promise<PlatformInterestSummary> {
  const profiles = precomputedProfiles ?? (await computeAllTraineeProfiles(now));

  const topCounts = new Map<string, number>();
  const emergingCounts = new Map<string, number>();

  for (const profile of profiles.values()) {
    for (const topic of [profile.primary, ...profile.secondary].filter((t): t is string => t !== null)) {
      topCounts.set(topic, (topCounts.get(topic) ?? 0) + 1);
    }
    for (const topic of profile.emerging) {
      emergingCounts.set(topic, (emergingCounts.get(topic) ?? 0) + 1);
    }
  }

  const toSortedList = (m: Map<string, number>) =>
    [...m.entries()].sort(([, a], [, b]) => b - a).map(([topic, traineeCount]) => ({ topic, traineeCount }));

  return { topTopics: toSortedList(topCounts), emergingTopics: toSortedList(emergingCounts) };
}
