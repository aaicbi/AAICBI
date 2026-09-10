/**
 * Loop Question Bank — resolves a free-text module reference (e.g.
 * "Data Cleaning" or "Module 3") to a real module id. Same ambiguity
 * discipline as src/lib/messaging/recipients.ts's COURSE/COHORT
 * scopes: 0 matches or 2+ matches are returned as-is rather than
 * guessing, so the ask route (or a human reviewing a Loop reply) can
 * ask a clarifying question instead of silently picking the wrong
 * module.
 */
import { prisma } from "@/lib/prisma";

export interface ResolvedModule {
  id: string;
  title: string;
  courseTitle: string;
}

export interface ResolveModuleResult {
  module: ResolvedModule | null;
  // 2+ modules matched the free-text query — the caller should ask
  // which one was meant, never guess by picking the first match.
  ambiguousMatches?: string[];
}

export async function resolveModuleByQuery(query: string): Promise<ResolveModuleResult> {
  const modules = await prisma.module.findMany({
    where: { title: { contains: query, mode: "insensitive" } },
    select: { id: true, title: true, course: { select: { title: true } } },
    take: 10,
  });

  if (modules.length === 0) return { module: null };
  if (modules.length > 1) {
    return { module: null, ambiguousMatches: modules.map((m) => `${m.course.title} — ${m.title}`) };
  }

  const match = modules[0];
  return { module: { id: match.id, title: match.title, courseTitle: match.course.title } };
}
