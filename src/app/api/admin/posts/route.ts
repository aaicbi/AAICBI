import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";
import { postsForReview } from "@/lib/posts/posts";
import type { PostStatus } from "@/lib/posts/postCore";

export const dynamic = "force-dynamic";

const STATUSES = ["PENDING_REVIEW", "CHANGES_REQUESTED", "PUBLISHED", "REJECTED", "SUSPENDED", "DRAFT"];

/** GET ?status=PENDING_REVIEW — SUPER_ADMIN reads posts by status for review. */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const status = req.nextUrl.searchParams.get("status") ?? "PENDING_REVIEW";
    if (!STATUSES.includes(status)) return NextResponse.json({ error: "Unknown status." }, { status: 400 });
    return NextResponse.json({ posts: await postsForReview(status as PostStatus) });
  });
}
