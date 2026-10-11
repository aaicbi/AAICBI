import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { dashboardHrefFor } from "@/lib/auth/home";
import { profileForSession } from "@/lib/profiles/handleChanges";
import { cardsFor } from "@/lib/profiles/card";

export const dynamic = "force-dynamic";

/** A few facts for the site header of the signed-in person: their name, picture, public address and dashboard. Nothing else. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ signedIn: false }, { headers: { "Cache-Control": "private, no-store" } });
  const [dashboard, profile] = await Promise.all([dashboardHrefFor(session), profileForSession(session)]);
  const card = profile ? (await cardsFor([profile])).get(profile.id) : null;
  return NextResponse.json(
    { signedIn: true, name: card?.name ?? session.email, avatarUrl: card?.avatarUrl ?? null, square: card?.square ?? false, handle: profile?.handle ?? null, kindLabel: card?.kindLabel ?? null, dashboardHref: dashboard },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
