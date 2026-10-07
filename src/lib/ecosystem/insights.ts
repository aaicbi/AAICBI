import { prisma } from "@/lib/prisma";
import { improvementTips, percent, periodStart } from "@/lib/ecosystem/insightsCore";
import { rateOrganizations } from "@/lib/ecosystem/visibility";

export const PERIOD_DAYS = 30;

export async function getOrgInsights(org: { id: string; staffUserId: string | null }, now = new Date()) {
  const since = periodStart(PERIOD_DAYS, now);
  const courses = org.staffUserId
    ? await prisma.course.findMany({ where: { createdById: org.staffUserId }, select: { id: true, title: true } })
    : [];
  const courseIds = courses.map((c) => c.id);

  const [grouped, follows, reactions, enrollments, posts, clickRows] = await Promise.all([
    prisma.ecosystemEvent.groupBy({ by: ["type"], where: { trainingOrganizationId: org.id, createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.organizationFollow.count({ where: { trainingOrganizationId: org.id, createdAt: { gte: since } } }),
    prisma.educationPostReaction.count({ where: { post: { trainingOrganizationId: org.id }, createdAt: { gte: since } } }),
    courseIds.length ? prisma.courseEnrollment.count({ where: { courseId: { in: courseIds }, enrolledAt: { gte: since } } }) : Promise.resolve(0),
    prisma.educationPost.findMany({
      where: { trainingOrganizationId: org.id, status: "PUBLISHED" },
      select: { id: true, title: true, thumbnailUrl: true, viewCount: true, _count: { select: { reactions: true } } },
    }),
    prisma.ecosystemEvent.groupBy({ by: ["courseId"], where: { trainingOrganizationId: org.id, type: "PROGRAM_CLICK", createdAt: { gte: since } }, _count: { _all: true } }),
  ]);

  const count = (t: string) => grouped.find((g) => g.type === t)?._count._all ?? 0;
  const profileViews = count("PROFILE_VIEW");
  const videoViews = count("VIDEO_VIEW");
  const programClicks = count("PROGRAM_CLICK");

  const viewsByPost = await prisma.ecosystemEvent.groupBy({
    by: ["postId"], where: { trainingOrganizationId: org.id, type: "VIDEO_VIEW", createdAt: { gte: since }, postId: { not: null } }, _count: { _all: true },
  });
  const topVideos = posts
    .map((p) => ({ id: p.id, title: p.title, thumbnailUrl: p.thumbnailUrl, views: viewsByPost.find((v) => v.postId === p.id)?._count._all ?? 0, totalViews: p.viewCount, reactions: p._count.reactions }))
    .sort((a, b) => b.views - a.views || b.totalViews - a.totalViews)
    .slice(0, 5);
  const topPrograms = clickRows
    .filter((r) => r.courseId)
    .map((r) => ({ courseId: r.courseId!, title: courses.find((c) => c.id === r.courseId)?.title ?? "Program", clicks: r._count._all }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 5);

  const rated = (await rateOrganizations(undefined, now)).find((r) => r.id === org.id);
  return {
    days: PERIOD_DAYS,
    totals: { profileViews, videoViews, programClicks, newFollowers: follows, likesAndSaves: reactions, newEnrollments: enrollments },
    funnel: { viewsToClicks: percent(programClicks, videoViews + profileViews) },
    topVideos,
    topPrograms,
    visibility: rated ? { badges: rated.badges, components: rated.result.components, tips: improvementTips(rated.result.components) } : null,
  };
}

/** Platform-wide totals for SUPER_ADMIN. Demo organizations are left out so the numbers stay real. */
export async function getPlatformAnalytics(now = new Date()) {
  const since = periodStart(PERIOD_DAYS, now);
  const realOrg = { isDemo: false };
  const [grouped, byOrg, follows, published, orgsLive, enrollments] = await Promise.all([
    prisma.ecosystemEvent.groupBy({ by: ["type"], where: { createdAt: { gte: since }, trainingOrganization: realOrg }, _count: { _all: true } }),
    prisma.ecosystemEvent.groupBy({ by: ["trainingOrganizationId"], where: { createdAt: { gte: since }, trainingOrganization: realOrg }, _count: { _all: true }, orderBy: { _count: { trainingOrganizationId: "desc" } }, take: 5 }),
    prisma.organizationFollow.count({ where: { createdAt: { gte: since }, trainingOrganization: realOrg } }),
    prisma.educationPost.count({ where: { status: "PUBLISHED", publishedAt: { gte: since }, trainingOrganization: realOrg } }),
    prisma.trainingOrganization.count({ where: { ...realOrg, approvalState: "APPROVED", publicProfile: { is: { publicEnabled: true } } } }),
    prisma.trainingOrganization.findMany({ where: { ...realOrg, staffUserId: { not: null } }, select: { staffUserId: true } }).then((rows) =>
      prisma.courseEnrollment.count({ where: { enrolledAt: { gte: since }, course: { createdById: { in: rows.map((r) => r.staffUserId!) } } } }),
    ),
  ]);
  const names = await prisma.trainingOrganization.findMany({ where: { id: { in: byOrg.map((o) => o.trainingOrganizationId) } }, select: { id: true, name: true } });
  const count = (t: string) => grouped.find((g) => g.type === t)?._count._all ?? 0;
  return {
    days: PERIOD_DAYS,
    totals: { profileViews: count("PROFILE_VIEW"), videoViews: count("VIDEO_VIEW"), programClicks: count("PROGRAM_CLICK"), newFollows: follows, videosPublished: published, publicOrganizations: orgsLive, enrollments },
    topOrganizations: byOrg.map((o) => ({ name: names.find((n) => n.id === o.trainingOrganizationId)?.name ?? "Organization", interactions: o._count._all })),
  };
}
