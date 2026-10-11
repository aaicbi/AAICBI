import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { getEcosystemFlags } from "@/lib/ecosystem/flags";
import { normalizeQuery } from "@/lib/ecosystem/searchCore";
import { openJobWhere } from "@/lib/landing/publicWhere";
import { searchProfiles } from "@/lib/profiles/profileSearch";

export const dynamic = "force-dynamic";

/** Published programs of organizations that have a public page, by title. */
async function publicPrograms(q: string) {
  const orgs = await prisma.trainingOrganization.findMany({ where: { approvalState: "APPROVED", publicProfile: { is: { publicEnabled: true } }, staffUserId: { not: null } }, select: { staffUserId: true } });
  return prisma.course.findMany({ where: { status: "PUBLISHED", title: { contains: q, mode: "insensitive" }, createdById: { in: orgs.map((o) => o.staffUserId!) } }, orderBy: { createdAt: "desc" }, take: 3, select: { id: true, title: true } });
}

export interface Suggestion { kind: "profile" | "job" | "program" | "skill"; label: string; sub: string | null; href: string }

/**
 * GET /api/search/suggest?q=... gives up to eight quick suggestions while someone types: people, organizations, startups,
 * employers, open jobs, public programs and skills. It reads only what the full search may read (the same visibility rule for
 * profiles, open jobs of approved employers, programs of public organizations) and returns names and addresses, nothing else.
 * Limited per address so it cannot be used to scrape. Anything wrong returns an empty list, never an error page.
 */
export async function GET(req: NextRequest) {
  const empty = NextResponse.json({ items: [] as Suggestion[] }, { headers: { "Cache-Control": "private, no-store" } });
  const q = normalizeQuery(req.nextUrl.searchParams.get("q"));
  if (!q) return empty;
  const limited = await rateLimit(`suggest:${clientIp(req)}`, 120, 60 * 1000);
  if (!limited.allowed) return NextResponse.json({ items: [] as Suggestion[], error: "Too many searches. Please wait a moment." }, { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } });
  try {
    const [flags, viewer] = await Promise.all([getEcosystemFlags(), getSession()]);
    if (!flags.orgPages) return empty;
    const has = { contains: q, mode: "insensitive" as const };
    const [profiles, jobs, skills, courses] = await Promise.all([
      searchProfiles({ q, kinds: ["PERSON", "TRAINING_ORG", "STARTUP", "EMPLOYER"].filter((k) => k !== "PERSON" || flags.publicTrainees) as never, sort: "relevance", page: 1, size: 4, viewer }),
      flags.publicJobs ? prisma.jobPosting.findMany({ where: { ...openJobWhere(), OR: [{ title: has }, { employer: { companyName: has } }] }, orderBy: { createdAt: "desc" }, take: 3, select: { id: true, title: true, employer: { select: { companyName: true } } } }) : [],
      prisma.skill.findMany({ where: { name: has }, orderBy: { name: "asc" }, take: 3, select: { name: true } }),
      publicPrograms(q),
    ]);
    const items: Suggestion[] = [
      ...profiles.items.map((p) => ({ kind: "profile" as const, label: p.name, sub: [p.kindLabel, p.location].filter(Boolean).join(" · "), href: `/@${p.handle}` })),
      ...jobs.map((j) => ({ kind: "job" as const, label: j.title, sub: `Job · ${j.employer.companyName}`, href: `/jobs/${j.id}` })),
      ...courses.map((c) => ({ kind: "program" as const, label: c.title, sub: "Program", href: `/courses/${c.id}` })),
      ...skills.map((s) => ({ kind: "skill" as const, label: s.name, sub: "Skill · see people who list it", href: `/search?kind=people&skill=${encodeURIComponent(s.name)}` })),
    ].slice(0, 8);
    return NextResponse.json({ items }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("Search suggestions failed:", e instanceof Error ? e.message : e);
    return empty;
  }
}
