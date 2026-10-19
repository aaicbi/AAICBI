import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { courseShareTarget } from "@/lib/growth/share";
import { renderSharePdf } from "@/lib/growth/sharePdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?src= — the clickable PDF of the play card for this course. The whole card links to the course's funnel, tagged with the source label. Super Admin only. */
export async function GET(req: NextRequest, { params }: { params: { courseId: string } }) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const target = await courseShareTarget(params.courseId, req.nextUrl.searchParams.get("src") || "pdf");
    if (!target) return NextResponse.json({ error: "That course has no campaign yet." }, { status: 404 });
    // The still card is a static file of this app, fetched from the same address that served this request.
    const res = await fetch(new URL("/growth/play-card.png", req.nextUrl.origin));
    if (!res.ok) return NextResponse.json({ error: "The card image is missing." }, { status: 500 });
    const pdf = await renderSharePdf({ link: target.link, poster: Buffer.from(await res.arrayBuffer()), title: target.title });
    const name = `AAICBI-Play-Card-${target.title.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").slice(0, 40)}.pdf`;
    return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
  });
}
