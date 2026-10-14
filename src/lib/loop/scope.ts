/**
 * What a person may see through Loop. A Super Admin sees everything; organization staff, admins and
 * instructors see only modules of courses they own or were invited to edit, and games they made.
 * Every module and game lookup Loop does goes through here so the limit cannot be skipped by one tool.
 */
import type { StudioPermission } from "@/lib/quest/permissions";
import { prisma } from "@/lib/prisma";
import { courseAccess } from "@/lib/collab/access";
import { resolveModuleByQuery, type ResolveModuleResult } from "@/lib/loop/moduleLookup";

export interface LoopScope {
  userId: string;
  role: string;
  isSuper: boolean;
  /** What this person may do in the studio. Left out for a Super Admin, who may do everything. */
  permissions?: StudioPermission[];
}

/** Like resolveModuleByQuery, but for a limited person only the modules they may work on can match. */
export async function resolveModuleForScope(query: string, scope: LoopScope): Promise<ResolveModuleResult> {
  if (scope.isSuper) return resolveModuleByQuery(query);
  const modules = await prisma.module.findMany({
    where: { title: { contains: query, mode: "insensitive" } },
    select: { id: true, title: true, courseId: true, course: { select: { id: true, title: true, createdById: true } } },
    take: 50,
  });
  const mine = [];
  for (const m of modules) if (await courseAccess({ id: m.course.id, createdById: m.course.createdById }, scope.userId, scope.role)) mine.push(m);
  if (mine.length === 0) return { module: null };
  if (mine.length > 1) return { module: null, ambiguousMatches: mine.slice(0, 10).map((m) => `${m.course.title} — ${m.title}`) };
  const m = mine[0];
  return { module: { id: m.id, title: m.title, courseId: m.courseId, courseTitle: m.course.title } };
}
