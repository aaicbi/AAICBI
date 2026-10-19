import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { AdsError, adSettings, createAd, deleteAd, listAds, setAdSettings, setPaused, setPayment, updateAd } from "@/lib/ads/ads";

export const dynamic = "force-dynamic";

async function snapshot() {
  const [settings, list] = await Promise.all([adSettings(), listAds()]);
  return NextResponse.json({ settings, ...list }, { headers: { "Cache-Control": "no-store" } });
}

/** GET — the master switch, every booked ad and the approved organizations to book for. Super Admin only. */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    return snapshot();
  });
}

/** POST {action} — settings, create, update, pause, payment, delete. Super Admin only; every change is logged. */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const s = await requireRole("SUPER_ADMIN");
    const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!b || typeof b.action !== "string") return NextResponse.json({ error: "That change wasn't understood." }, { status: 400 });
    const id = typeof b.id === "string" ? b.id : "";
    try {
      switch (b.action) {
        case "settings":
          await setAdSettings(s.userId, { enabled: typeof b.enabled === "boolean" ? b.enabled : undefined, house: typeof b.house === "boolean" ? b.house : undefined });
          break;
        case "create": await createAd(s.userId, (b.ad ?? {}) as Record<string, unknown>); break;
        case "update": await updateAd(s.userId, id, (b.ad ?? {}) as Record<string, unknown>); break;
        case "pause": await setPaused(s.userId, id, b.paused === true); break;
        case "payment": await setPayment(s.userId, id, b.status as "UNPAID" | "PAID" | "FREE", b.priceNaira); break;
        case "delete": await deleteAd(s.userId, id); break;
        default: return NextResponse.json({ error: "That change wasn't understood." }, { status: 400 });
      }
    } catch (e) {
      if (e instanceof AdsError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
    return snapshot();
  });
}
