import { NextRequest } from "next/server";
import { z } from "zod";
import { arenaJson, arenaTrainee } from "@/lib/arena/arenaApi";
import { ArenaError } from "@/lib/arena/arena";
import { prefsOf, setChallengeMute } from "@/lib/arena/prefs";

export const dynamic = "force-dynamic";

/** GET — this trainee's arena settings: whether phone alerts for challenges are muted, and until when. */
export async function GET() {
  return arenaJson(async () => prefsOf(await arenaTrainee()));
}

const Body = z.object({ mute: z.enum(["off", "1h", "8h", "forever"]) });

/** PUT { mute } — mute challenge alerts for an hour, eight hours or until turned back on, or turn them back on. */
export async function PUT(req: NextRequest) {
  return arenaJson(async () => {
    const me = await arenaTrainee();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ArenaError("Choose how long to mute challenge alerts.");
    return setChallengeMute(me, parsed.data.mute);
  });
}
