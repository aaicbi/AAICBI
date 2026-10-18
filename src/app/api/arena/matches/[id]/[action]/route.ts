import { NextRequest } from "next/server";
import { arenaJson, arenaTrainee, limit } from "@/lib/arena/arenaApi";
import { ArenaError, answer, leaveMatch, pause, pick, react, respondToChallenge, resume, sendMessage, setReady } from "@/lib/arena/arena";
import { PICK_RATE } from "@/lib/arena/arenaCore";
import { viewMatch } from "@/lib/arena/arenaView";

export const dynamic = "force-dynamic";

/** POST — one player action on a match; answers with the fresh view so the screen updates at once. */
export async function POST(req: NextRequest, { params }: { params: { id: string; action: string } }) {
  return arenaJson(async () => {
    const me = await arenaTrainee();
    const { id, action } = params;
    const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    switch (action) {
      case "accept": await respondToChallenge(id, me, true); break;
      case "decline": await respondToChallenge(id, me, false); break;
      case "ready": await setReady(id, me, body.ready !== false); break;
      case "pick": await pick(id, me, Number(body.number)); break;
      case "answer": await answer(id, me, body.response); break;
      case "pause": await pause(id, me); break;
      case "resume": await resume(id, me); break;
      case "leave": await leaveMatch(id, me); break;
      case "message":
        await limit(`arena:msg:${me}`, PICK_RATE.messages, PICK_RATE.messagesPer);
        await sendMessage(id, me, body.body);
        break;
      case "react":
        await limit(`arena:react:${me}`, PICK_RATE.reactions, PICK_RATE.reactionsPer);
        await react(id, me, String(body.kind ?? ""));
        break;
      default: throw new ArenaError("Unknown action.", 404);
    }
    return viewMatch(id, me);
  });
}
