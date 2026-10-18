import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { cardData } from "@/lib/growth/growth";
import { CARD_SIZES, cardFormat, displayName } from "@/lib/growth/growthCore";

export const dynamic = "force-dynamic";

const INK = "#06231a";
const MINT = "#3fd6a0";
const GOLD = "#f2c14e";
const TEXT = "#eafaf2";
const MUTED = "#9db8ab";
const RED = "#ff8f86";

/** GET — the result card image for a finished play: 1200x630 for link previews, or ?format=status for a 1080x1920 WhatsApp Status. The code is public; it exposes only the name, score and answer grid the player chose to share. */
export async function GET(req: NextRequest, { params }: { params: { slug: string; code: string } }) {
  const limit = await rateLimit(`growth-card:${clientIp(req)}`, 120, 10 * 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Please wait a few minutes." }, { status: 429 });
  const d = await cardData(params.slug, params.code);
  if (!d) return NextResponse.json({ error: "That card isn't available." }, { status: 404 });
  const format = cardFormat(req.nextUrl.searchParams.get("format"));
  const { width, height } = CARD_SIZES[format];
  const tall = format === "status";
  const who = displayName(d.name);
  const unit = tall ? 1.6 : 1;
  const sq = Math.round(64 * unit);

  return new ImageResponse(
    (
      <div style={{ width, height, display: "flex", flexDirection: "column", justifyContent: "space-between", background: INK, color: TEXT, padding: tall ? 96 : 56, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 30 * unit, fontWeight: 700, color: MINT, letterSpacing: 2 }}>AAICBI · AYAKBI ARENA</div>
          {d.organizationName ? <div style={{ display: "flex", fontSize: 26 * unit, color: MUTED, marginTop: 8 }}>{d.organizationName}</div> : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: tall ? "center" : "flex-start" }}>
          <div style={{ display: "flex", fontSize: 40 * unit, color: GOLD, fontWeight: 700 }}>{d.rank.label}</div>
          <div style={{ display: "flex", fontSize: (tall ? 360 : 230), fontWeight: 800, lineHeight: 1.05 }}>{`${d.score}/${d.total}`}</div>
          <div style={{ display: "flex", marginTop: 24 * unit }}>
            {d.grid.map((ok, i) => (
              <div key={i} style={{ display: "flex", width: sq, height: sq, borderRadius: 14 * unit, marginRight: i === d.grid.length - 1 ? 0 : 14 * unit, background: ok ? MINT : RED }} />
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: tall ? "center" : "flex-start" }}>
          <div style={{ display: "flex", fontSize: 46 * unit, fontWeight: 800, textAlign: tall ? "center" : "left" }}>{`Can you beat ${d.name ? who : "my score"}?`}</div>
          <div style={{ display: "flex", fontSize: 28 * unit, color: MUTED, marginTop: 10 }}>{`5 questions · 90 seconds · no signup`}</div>
          <div style={{ display: "flex", fontSize: 30 * unit, color: MINT, fontWeight: 700, marginTop: 14 }}>{d.link}</div>
        </div>
      </div>
    ),
    { width, height, headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" } }
  );
}
