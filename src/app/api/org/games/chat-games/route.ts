import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chatGames, closeChatGame, orgCtx, removeMessage } from "@/lib/orggames/orgGames";
import { noStore, orgGamesApi } from "@/lib/orggames/http";

export const dynamic = "force-dynamic";

/** GET ?courseId — games started in the organization's course group chats (Fastest Fingers, challenges) and recently removed messages. */
export async function GET(req: NextRequest) {
  return orgGamesApi(async () => {
    const ctx = await orgCtx("org_games.results:view");
    return NextResponse.json(await chatGames(ctx, (req.nextUrl.searchParams.get("courseId") ?? "") || null), { headers: noStore });
  });
}

const id = z.string().min(1).max(80);
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("removeMessage"), courseId: id, messageId: id, reason: z.string().max(600) }),
  z.object({ action: z.literal("closeGame"), courseId: id, sprintId: id, reason: z.string().max(600) }),
]);

/** POST {action}: remove a game-related chat message, or stop one chat game. Needs the chat-game moderation permission and a reason. */
export async function POST(req: NextRequest) {
  return orgGamesApi(async () => {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "That request wasn't understood." }, { status: 400 });
    const ctx = await orgCtx("org_games.chat_games:moderate");
    const b = parsed.data;
    if (b.action === "removeMessage") await removeMessage(ctx, b); else await closeChatGame(ctx, b);
    return NextResponse.json(await chatGames(ctx, b.courseId), { headers: noStore });
  });
}
