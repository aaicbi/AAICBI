import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit } from "@/lib/rateLimit";
import { getSession } from "@/lib/auth/session";
import { EventsError, actorOf, getEventSettings, requireActor, type Actor } from "@/lib/events/eventsAccess";
import {
  archiveEvent, cancelEvent, createSeries, deleteDraft, eventDetail, joinDetails, listCategories, listManagedEvents, listVisibleEvents, manageDetail, overview, promotionAction, saveCategory, saveEvent, updateSettings,
  type Filters, type PromotionInput, type SaveAction,
} from "@/lib/events/events";
import type { Recurrence } from "@/lib/events/eventsCore";
import { applyAttendanceReport, decideRegistration, exportRegistrations, previewAttendanceReport, listRegistrations, markAttendance, register, cancelMyRegistration } from "@/lib/events/eventsRegistration";
import { opensManager } from "@/lib/events/eventsAccess";

/** Shared by the organization's routes and the platform's routes: who is acting decides what is allowed, so both ask the same code. */
export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export function guarded(handler: () => Promise<NextResponse>): Promise<NextResponse> {
  return withApiErrors(async () => {
    try { return await handler(); } catch (e) {
      if (e instanceof EventsError) return json({ error: e.message, fields: e.fields }, e.status);
      throw e;
    }
  });
}
const body = async (req: NextRequest) => ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;

export function filtersFrom(sp: URLSearchParams): Filters {
  const s = (k: string) => sp.get(k) || undefined;
  const when = s("when");
  return {
    q: s("q"), categoryId: s("category"), delivery: s("delivery"), organizer: s("organizer"), audience: s("audience"), status: s("status"), promotion: s("promotion"), type: s("type"),
    when: when === "upcoming" || when === "live" || when === "past" || when === "all" ? when : undefined, from: s("from"), to: s("to"),
    take: sp.get("take") ? Number(sp.get("take")) : undefined, page: sp.get("page") ? Number(sp.get("page")) : undefined, orgId: s("org"),
  };
}

async function limited(a: Actor, what: string, max: number) {
  const r = await rateLimit(`event-${what}:${a.userId}`, max, 3600_000);
  if (!r.allowed) throw new EventsError("You are doing that very quickly. Try again in a little while.", 429);
}

// ------------------------------------------------------------------------------------------------ manager handlers

/** The manager's lists, calendar and numbers: GET /api/{admin|org}/events */
export const managerList = (req: NextRequest) => guarded(async () => {
  const a = await requireActor();
  const s = await getEventSettings();
  const kind = a.kind === "ORGANIZATION" ? "organization" : "platform";
  if (!opensManager(a.permissions, kind)) throw new EventsError("You do not have access to the Event Manager.", 403);
  const f = filtersFrom(req.nextUrl.searchParams);
  const [list, nums, categories] = await Promise.all([listManagedEvents(a, f), overview(a), listCategories(!a.permissions.has("events.categories:manage"))]);
  return json({ ...list, overview: nums, categories, settings: s, actor: { kind: a.kind, orgId: a.orgId, orgName: a.orgName, permissions: [...a.permissions].filter((k) => k.startsWith("events.") || k.startsWith("org_events.")) } });
});

export const managerCreate = (req: NextRequest) => guarded(async () => {
  const a = await requireActor();
  await limited(a, "save", 60);
  const b = await body(req);
  const common = { data: b.data, action: (b.action as SaveAction) ?? "save", organizationId: typeof b.organizationId === "string" ? b.organizationId : null };
  const rec = b.recurrence as Recurrence | null | undefined;
  if (rec && typeof rec === "object") return json(await createSeries(a, { ...common, recurrence: { freq: rec.freq, weekdays: Array.isArray(rec.weekdays) ? rec.weekdays.map(Number) : undefined, count: rec.count === undefined || rec.count === null ? undefined : Number(rec.count), until: typeof rec.until === "string" && rec.until ? rec.until : undefined } }), 201);
  return json(await saveEvent(a, common), 201);
});

export const managerDetail = (id: string) => guarded(async () => json(await manageDetail(await requireActor(), id)));

export const managerUpdate = (req: NextRequest, id: string) => guarded(async () => {
  const a = await requireActor();
  await limited(a, "save", 120);
  const b = await body(req);
  return json(await saveEvent(a, { id, data: b.data, action: (b.action as SaveAction) ?? "save" }));
});

export const managerDelete = (id: string) => guarded(async () => { await deleteDraft(await requireActor(), id); return json({ deleted: true }); });
export const managerCancel = (req: NextRequest, id: string) => guarded(async () => { const b = await body(req); return json({ event: await cancelEvent(await requireActor(), id, String(b.reason ?? ""), b.scope === "series" ? "series" : "one") }); });
export const managerArchive = (id: string) => guarded(async () => json({ event: await archiveEvent(await requireActor(), id) }));

export const managerPromotion = (req: NextRequest, id: string) => guarded(async () => {
  const a = await requireActor();
  const b = await body(req);
  const allowed = ["submit", "withdraw", "approve", "reject", "request_changes", "publish", "unpublish"];
  if (typeof b.action !== "string" || !allowed.includes(b.action)) throw new EventsError("That action was not understood.", 400);
  return json({ event: await promotionAction(a, id, { action: b.action as PromotionInput["action"], reason: typeof b.reason === "string" ? b.reason : undefined, publishAtLocal: typeof b.publishAtLocal === "string" && b.publishAtLocal ? b.publishAtLocal : null }) });
});

export const managerRegistrations = (id: string) => guarded(async () => json(await listRegistrations(await requireActor(), id)));
export const managerRegistrationAction = (req: NextRequest, _id: string) => guarded(async () => {
  const a = await requireActor();
  const b = await body(req);
  const rid = typeof b.registrationId === "string" ? b.registrationId : "";
  if (b.op === "confirm" || b.op === "decline") await decideRegistration(a, rid, b.op, typeof b.reason === "string" ? b.reason : undefined);
  else if (b.op === "attended" || b.op === "not_attended") await markAttendance(a, rid, b.op === "attended");
  else if (b.op === "import_preview" || b.op === "import_apply") {
    const csv = typeof b.csv === "string" ? b.csv : "";
    const min = b.minMinutes === undefined || b.minMinutes === "" ? 5 : Number(b.minMinutes);
    if (b.op === "import_preview") return json({ preview: await previewAttendanceReport(a, _id, csv, min) });
    return json({ ok: true, ...(await applyAttendanceReport(a, _id, csv, min)) });
  } else throw new EventsError("That action was not understood.", 400);
  return json({ ok: true });
});
export const managerExport = (id: string) => guarded(async () => {
  const { filename, csv } = await exportRegistrations(await requireActor(), id);
  return new NextResponse(csv, { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" } });
});

/** Cohorts, courses and trainees an event can be aimed at: an organisation sees its own; platform staff see those of the organisation they choose (or AAICBI's own). */
export const audienceOptions = (req: NextRequest) => guarded(async () => {
  const a = await requireActor();
  const orgParam = req.nextUrl.searchParams.get("org");
  let ownerUserId: string | null | undefined;
  if (a.kind === "ORGANIZATION") ownerUserId = (await prisma.trainingOrganization.findUnique({ where: { id: a.orgId ?? "" }, select: { staffUserId: true } }))?.staffUserId;
  else if (orgParam) ownerUserId = (await prisma.trainingOrganization.findUnique({ where: { id: orgParam }, select: { staffUserId: true } }))?.staffUserId;
  const courseWhere = ownerUserId ? { createdById: ownerUserId } : a.kind === "ORGANIZATION" ? { id: "none" } : { createdBy: { trainingOrgAsStaffUser: null } };
  const courses = await prisma.course.findMany({ where: courseWhere, orderBy: { title: "asc" }, take: 200, select: { id: true, title: true, cohorts: { select: { id: true, name: true }, orderBy: { createdAt: "desc" }, take: 20 } } });
  const trainees = ownerUserId
    ? await prisma.courseEnrollment.findMany({ where: { course: { createdById: ownerUserId }, accessRevokedAt: null }, distinct: ["traineeId"], take: 500, select: { trainee: { select: { id: true, name: true } } } })
    : [];
  const orgs = a.kind === "ORGANIZATION" ? [] : await prisma.trainingOrganization.findMany({ where: { approvalState: "APPROVED" }, orderBy: { name: "asc" }, take: 300, select: { id: true, name: true } });
  return json({
    courses: courses.map((c) => ({ id: c.id, title: c.title })),
    cohorts: courses.flatMap((c) => c.cohorts.map((h) => ({ id: h.id, name: `${c.title}: ${h.name}` }))),
    trainees: trainees.map((t) => t.trainee).sort((x, y) => x.name.localeCompare(y.name)),
    organizations: orgs,
  });
});

// ------------------------------------------------------------------------------------------------ platform-only handlers

export const platformCategories = () => guarded(async () => { const a = await requireActor(); return json({ categories: await listCategories(!a.permissions.has("events.categories:manage")) }); });
export const platformCategorySave = (req: NextRequest) => guarded(async () => json({ category: await saveCategory(await requireActor(), await body(req)) }));
export const platformSettings = (req: NextRequest) => guarded(async () => {
  const a = await requireActor();
  if (req.method === "POST") return json({ settings: await updateSettings(a, await body(req)) });
  return json({ settings: await getEventSettings() });
});

// ------------------------------------------------------------------------------------------------ participant handlers (everyone)

async function optionalActor(): Promise<{ session: Awaited<ReturnType<typeof getSession>>; actor: Actor | null }> {
  const session = await getSession();
  const actor = session && (session.role === "SUPER_ADMIN" || session.role === "ADMIN" || session.role === "INSTRUCTOR") ? await actorOf(session).catch(() => null) : null;
  return { session, actor };
}

export const publicList = (req: NextRequest) => guarded(async () => {
  const session = await getSession();
  return json(await listVisibleEvents(session, filtersFrom(req.nextUrl.searchParams)));
});
export const publicDetail = (id: string) => guarded(async () => {
  const { session, actor } = await optionalActor();
  const d = await eventDetail(id, session, actor);
  if (!d) throw new EventsError("That event was not found.", 404);
  return json(d);
});
export const publicJoin = (id: string) => guarded(async () => {
  const { session, actor } = await optionalActor();
  return json(await joinDetails(id, session, actor));
});
export const publicRegister = (req: NextRequest, id: string) => guarded(async () => {
  const session = await getSession();
  if (session) { const r = await rateLimit(`event-register:${session.userId}`, 60, 3600_000); if (!r.allowed) throw new EventsError("You are doing that very quickly. Try again in a little while.", 429); }
  return json(await register(session, id, (await body(req)).attendanceMode));
});
export const publicUnregister = (id: string) => guarded(async () => { await cancelMyRegistration(await getSession(), id); return json({ ok: true }); });
export const publicCategories = () => guarded(async () => json({ categories: await listCategories(true) }));
