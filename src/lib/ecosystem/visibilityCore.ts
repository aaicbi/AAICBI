import { z } from "zod";

/**
 * Organization visibility score — pure maths, no database. Every
 * component is normalised to 0..1 and the weights are set by
 * SUPER_ADMIN (PlatformSettings.ecosystemRankingConfig). The score
 * rewards steady, good educational content, not volume:
 *  - only published posts with real metadata count at full value,
 *  - at most `weeklyPostCap` posts per week count,
 *  - engagement is unique signed-in people (log-scaled), never the
 *    organization's own trainees,
 *  - consistency is distinct weeks with a publication, not post count.
 */

export const COMPONENTS = ["quality", "engagement", "consistency", "participation", "achievements", "programs"] as const;
export type Component = (typeof COMPONENTS)[number];

export const COMPONENT_LABELS: Record<Component, string> = {
  quality: "Content quality",
  engagement: "Engagement",
  consistency: "Consistency",
  participation: "Trainee participation",
  achievements: "Verified achievements",
  programs: "Program readiness",
};

export const RankingConfigSchema = z.object({
  weights: z.object({
    quality: z.number().min(0).max(10),
    engagement: z.number().min(0).max(10),
    consistency: z.number().min(0).max(10),
    participation: z.number().min(0).max(10),
    achievements: z.number().min(0).max(10),
    programs: z.number().min(0).max(10),
  }),
  weeklyPostCap: z.number().int().min(1).max(10),
  windowWeeks: z.number().int().min(4).max(26),
  featured: z.object({
    minScore: z.number().min(0).max(100),
    minPublishedVideos: z.number().int().min(0).max(100),
    maxFeatured: z.number().int().min(1).max(12),
    requireVerified: z.boolean(),
  }),
});
export type RankingConfig = z.infer<typeof RankingConfigSchema>;

export const DEFAULT_RANKING_CONFIG: RankingConfig = {
  weights: { quality: 3, engagement: 2, consistency: 2, participation: 1.5, achievements: 1, programs: 1 },
  weeklyPostCap: 2,
  windowWeeks: 12,
  featured: { minScore: 40, minPublishedVideos: 3, maxFeatured: 6, requireVerified: true },
};

/** Reads stored JSON back into a valid config; anything missing or invalid falls back to defaults. */
export function parseRankingConfig(raw: unknown): RankingConfig {
  const merged = {
    ...DEFAULT_RANKING_CONFIG,
    ...(raw && typeof raw === "object" ? (raw as object) : {}),
  } as Record<string, unknown>;
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  merged.weights = { ...DEFAULT_RANKING_CONFIG.weights, ...((r.weights as object) ?? {}) };
  merged.featured = { ...DEFAULT_RANKING_CONFIG.featured, ...((r.featured as object) ?? {}) };
  const parsed = RankingConfigSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_RANKING_CONFIG;
}

/** What the data layer measures for one organization. */
export interface OrgSignals {
  /** Published posts inside the window: when and how complete. */
  posts: Array<{ publishedAt: Date; hasDescription: boolean; skillCount: number; linkedProgram: boolean; traineeId: string }>;
  /** Distinct signed-in people (not the org's own trainees) who liked or saved any post, and total views. */
  uniqueEngagers: number;
  views: number;
  followers: number;
  certificatesIssued: number;
  programCount: number;
  programsWithSkills: number;
  verified: boolean;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
/** Smooth saturation: reaches ~0.63 at `half` and flattens out, so a huge number adds little. */
const saturate = (n: number, scale: number) => clamp01(1 - Math.exp(-Math.max(0, n) / scale));

export function weekIndex(d: Date, now: Date): number {
  return Math.floor((now.getTime() - d.getTime()) / (7 * 24 * 3600 * 1000));
}

/** A post only counts at full value once it has a description, at least one skill tag, and (bonus) a linked program. */
export function postQuality(p: OrgSignals["posts"][number]): number {
  return (p.hasDescription ? 0.4 : 0) + (p.skillCount > 0 ? 0.4 : 0) + (p.linkedProgram ? 0.2 : 0);
}

export interface ScoreResult {
  score: number; // 0..100
  components: Record<Component, number>; // each 0..1
}

export function computeVisibility(s: OrgSignals, cfg: RankingConfig, now = new Date()): ScoreResult {
  // Keep only posts in the window and apply the weekly cap (best-quality first within a week).
  const byWeek = new Map<number, OrgSignals["posts"]>();
  for (const p of s.posts) {
    const w = weekIndex(p.publishedAt, now);
    if (w < 0 || w >= cfg.windowWeeks) continue;
    byWeek.set(w, [...(byWeek.get(w) ?? []), p]);
  }
  const counted: OrgSignals["posts"] = [];
  for (const posts of byWeek.values()) {
    counted.push(...[...posts].sort((a, b) => postQuality(b) - postQuality(a)).slice(0, cfg.weeklyPostCap));
  }

  const quality = counted.length ? counted.reduce((n, p) => n + postQuality(p), 0) / counted.length : 0;
  // Engagement per counted post, so posting more does not dilute or inflate it unfairly.
  const engagement = counted.length ? saturate(s.uniqueEngagers + s.views / 20 + s.followers / 2, 12) : 0;
  const consistency = clamp01(byWeek.size / Math.min(cfg.windowWeeks, 8));
  const participation = saturate(new Set(counted.map((p) => p.traineeId)).size, 3);
  const achievements = saturate(s.certificatesIssued, 10);
  const programs = s.programCount ? s.programsWithSkills / s.programCount : 0;

  const components: Record<Component, number> = { quality, engagement, consistency, participation, achievements, programs };
  const totalWeight = COMPONENTS.reduce((n, c) => n + cfg.weights[c], 0);
  const weighted = totalWeight > 0 ? COMPONENTS.reduce((n, c) => n + components[c] * cfg.weights[c], 0) / totalWeight : 0;
  return { score: Math.round(weighted * 1000) / 10, components };
}

export type BadgeKey = "verified" | "consistent" | "active" | "trainees";
export const BADGE_LABELS: Record<BadgeKey, string> = {
  verified: "Verified",
  consistent: "Consistent educator",
  active: "Active this month",
  trainees: "Trainee-led learning",
};

/** Public reputation badges. The numeric score is never shown publicly. */
export function badgesFor(s: OrgSignals, r: ScoreResult, now = new Date()): BadgeKey[] {
  const out: BadgeKey[] = [];
  if (s.verified) out.push("verified");
  if (r.components.consistency >= 0.5) out.push("consistent");
  if (s.posts.some((p) => weekIndex(p.publishedAt, now) < 4)) out.push("active");
  if (r.components.participation >= 0.6) out.push("trainees");
  return out;
}

export interface Rated { id: string; verified: boolean; publishedVideos: number; score: number }

/** Featured = public criteria applied to the score; highest first, capped. */
export function pickFeatured<T extends Rated>(orgs: T[], cfg: RankingConfig): T[] {
  return orgs
    .filter((o) => o.score >= cfg.featured.minScore && o.publishedVideos >= cfg.featured.minPublishedVideos && (!cfg.featured.requireVerified || o.verified))
    .sort((a, b) => b.score - a.score)
    .slice(0, cfg.featured.maxFeatured);
}
