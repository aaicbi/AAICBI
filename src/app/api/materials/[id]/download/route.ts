import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { hasCourseAccess } from "@/lib/courseAccess";
import { getModuleLockStatus } from "@/lib/progress";
import { resolveDownloadUrl } from "@/lib/materialUrl";
import { isPubliclyFetchableUrl } from "@/lib/ssrfGuard";

/**
 * M40 — the actual tracking this milestone's content-change
 * notification depends on: recording a snapshot of the material's
 * updatedAt at the moment of THIS download. Comparing that snapshot
 * against the material's current updatedAt later is what detects a
 * genuine change, not a re-check on every request. Extracted as its
 * own function specifically because both the redirect path and the
 * proxy path below need to call it — a single shared write, not two
 * copies that could quietly drift apart.
 */
async function recordDownload(materialId: string, traineeId: string, materialUpdatedAt: Date): Promise<void> {
  await prisma.materialDownload
    .upsert({
      where: { traineeId_materialId: { traineeId, materialId } },
      update: { downloadedAt: new Date(), materialUpdatedAt, notifiedOfChangeAt: null },
      create: { traineeId, materialId, materialUpdatedAt },
    })
    .catch((e: unknown) => {
      // Never let a tracking-write failure block a download that
      // already succeeded — the same "side effect never blocks the
      // primary action" discipline used throughout this project.
      console.error(`Failed to record download for material ${materialId}, trainee ${traineeId}:`, e);
    });
}

/**
 * GET /api/materials/[id]/download — M40's actual download route. Same
 * access gate as viewing (enrollment + module unlock), the exact
 * dependency the roadmap's own framing calls out: downloading has to
 * respect the same rules as viewing, or it quietly becomes a way to
 * bypass enrollment — download once while enrolled, keep reading
 * forever after access lapses. Same "don't confirm existence" 404
 * pattern already used throughout this project's course/lesson
 * routes.
 *
 * The genuine content check that also naturally handles YouTube's own
 * real constraint — confirmed directly, not assumed: YouTube's Terms
 * of Service don't allow downloading video content, and there's no
 * legitimate API to fetch raw video bytes from a YouTube link.
 * Fetching a YouTube watch URL server-side returns its own HTML watch
 * page, not a file — checking the response's Content-Type for
 * `text/html` and rejecting it is what correctly refuses a YouTube
 * download without needing a special case for it: the same check
 * that protects against a Drive file whose sharing isn't actually
 * public also naturally rejects the one video source this app was
 * never able to offer downloads for.
 *
 * Audit finding, addressed here for VIDEO specifically: proxying a
 * large file through this server has two real, related costs, not
 * just one — it's bounded by this platform's own execution-time
 * ceiling (a genuinely large video over a slow connection could
 * exceed it and leave a trainee with a silently truncated download),
 * and every byte counts against this app's own hosting bandwidth,
 * metered beyond a certain point. Video is the one material type
 * large enough for either to plausibly matter — a redirect straight
 * to the source avoids both at once, since the actual transfer then
 * happens directly between the trainee's browser and the source,
 * never touching this server at all.
 *
 * Deliberately not applied to PDF/DOCX/PPTX — those are typically
 * small enough that neither cost is a real concern, and the existing
 * proxy path gives them a clean, custom filename a redirect can't
 * (the browser would otherwise use whatever name the source itself
 * provides).
 *
 * The redirect path still needs to know whether the source is
 * genuinely a downloadable file before sending a trainee there —
 * otherwise a broken or not-actually-public Drive link would redirect
 * them straight into a confusing HTML error page instead of a clear
 * message from this app. A HEAD request is the right tool for that:
 * it asks the server what it *would* send without transferring the
 * body, which is exactly the fast, cheap check this needs. Honest
 * about a real limit here, not glossed over: this sandbox has no way
 * to verify Google's own servers handle HEAD requests for this exact
 * endpoint the way the HTTP spec expects — a well-founded expectation
 * for spec-compliant infrastructure, but genuinely untested from here.
 * If the HEAD request itself fails for any reason, this falls back to
 * the original, already-proven proxy path for that one download
 * rather than ever blocking a trainee's access on an unverified
 * assumption.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const material = await prisma.material.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        url: true,
        type: true,
        updatedAt: true,
        lesson: {
          select: {
            module: {
              select: {
                id: true,
                courseId: true,
                course: { select: { published: true } },
              },
            },
          },
        },
      },
    });
    if (!material || !material.lesson.module.course.published) {
      return NextResponse.json({ error: "Material not found." }, { status: 404 });
    }

    const courseId = material.lesson.module.courseId;
    const enrolled = await hasCourseAccess(session.userId, courseId);
    if (!enrolled) {
      return NextResponse.json({ error: "You're not enrolled in this course yet." }, { status: 403 });
    }
    const lockStatus = await getModuleLockStatus(courseId, material.lesson.module.id, session.userId);
    if (!lockStatus?.unlocked) {
      return NextResponse.json(
        { error: "This module isn't unlocked yet — complete the previous module first." },
        { status: 403 }
      );
    }

    const downloadUrl = resolveDownloadUrl(material.url);

    // Audit finding, fixed here: this route makes a genuine
    // server-side fetch against a staff-provided URL — staff is a
    // lower trust boundary than this server's own code, and nothing
    // previously checked the URL's actual destination, only its
    // protocol (see safeUrl in materialUrl.ts). A material URL
    // pointing at an internal or cloud-metadata address (the classic
    // SSRF target) would otherwise have been fetched by this server
    // without question, then streamed straight back as a "download."
    // See ssrfGuard.ts's own comment for exactly what this does and
    // doesn't defend against. Applies before EITHER path below — the
    // redirect path still has this server making a real outbound HEAD
    // request first, the same SSRF surface as the proxy path's GET.
    if (!(await isPubliclyFetchableUrl(downloadUrl))) {
      console.error(`Refused to fetch material ${material.id}: URL does not resolve to a public address.`);
      return NextResponse.json({ error: "This material isn't available for offline download." }, { status: 415 });
    }

    if (material.type === "VIDEO") {
      try {
        const headResponse = await fetch(downloadUrl, { method: "HEAD" });
        const headContentType = headResponse.headers.get("content-type") ?? "";
        if (headResponse.ok && !headContentType.includes("text/html")) {
          await recordDownload(material.id, session.userId, material.updatedAt);
          return NextResponse.redirect(downloadUrl, 302);
        }
        if (headResponse.ok) {
          // HEAD genuinely answered and confirmed this isn't a real
          // file (still HTML) — the same "not available" case the
          // proxy path's own content-type check exists for. No point
          // falling through to a full GET that would just find the
          // same thing.
          return NextResponse.json({ error: "This material isn't available for offline download." }, { status: 415 });
        }
        // HEAD came back but wasn't ok — genuinely ambiguous (some
        // servers reject HEAD specifically while GET still works)
        // rather than a confirmed "not downloadable." Fall through to
        // the proxy path below rather than guess.
      } catch (e) {
        // The HEAD request itself failed — a real, honestly-expected
        // possibility this sandbox can't rule out for Drive
        // specifically. Falls through to the proxy path below, the
        // same already-proven mechanism this route used before this
        // change, rather than ever blocking a trainee's download on
        // an unverified assumption.
        console.error(`HEAD check failed for material ${material.id}, falling back to proxy download:`, e);
      }
    }

    let upstream: Response;
    try {
      upstream = await fetch(downloadUrl);
    } catch (e) {
      console.error(`Offline download fetch failed for material ${material.id}:`, e);
      return NextResponse.json({ error: "This material isn't available for offline download right now." }, { status: 502 });
    }
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "This material isn't available for offline download right now." }, { status: 502 });
    }
    const contentType = upstream.headers.get("content-type") ?? "";
    if (contentType.includes("text/html")) {
      // The genuine "this source can't actually be downloaded" case —
      // a YouTube link, or a Drive file that isn't actually shared
      // publicly. Deliberately the same message either way, not a
      // detailed explanation of which — see the top-level comment on
      // why this single check correctly handles both.
      return NextResponse.json({ error: "This material isn't available for offline download." }, { status: 415 });
    }

    await recordDownload(material.id, session.userId, material.updatedAt);

    const extension = material.type === "PDF" ? "pdf" : material.type === "DOCX" ? "docx" : material.type === "PPTX" ? "pptx" : "mp4";
    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${material.title.replace(/[^\w\s.-]/g, "")}.${extension}"`,
      },
    });
  });
}
