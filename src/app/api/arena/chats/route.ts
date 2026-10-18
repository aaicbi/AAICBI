import { arenaJson, arenaTrainee } from "@/lib/arena/arenaApi";
import { chatSummaries } from "@/lib/arena/chat";

export const dynamic = "force-dynamic";

/** GET — the signed-in trainee's course group chats with a preview and what is unread, for the Messages button. */
export async function GET() {
  return arenaJson(async () => ({ chats: await chatSummaries(await arenaTrainee()) }));
}
