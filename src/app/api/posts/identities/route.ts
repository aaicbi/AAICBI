import { NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { identitiesOf, postingBlockedReason } from "@/lib/posts/posts";
import { signedIn } from "@/lib/posts/http";

export const dynamic = "force-dynamic";

/** GET — what the signed-in person may post as (themselves, a startup they publish for, or their organization). */
export async function GET() {
  return withApiErrors(async () => {
    const s = await signedIn();
    if (s.error) return s.error;
    const list = await identitiesOf(s.session);
    return NextResponse.json({ identities: list.map((i) => ({ key: i.key, label: i.label, kind: i.kind, skipsReview: i.skipsReview })), blockedReason: list.length === 0 ? await postingBlockedReason(s.session) : null });
  });
}
