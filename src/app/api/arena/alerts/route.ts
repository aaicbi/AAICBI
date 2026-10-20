import { arenaJson, arenaTrainee } from "@/lib/arena/arenaApi";
import { attentionOf } from "@/lib/arena/attention";

export const dynamic = "force-dynamic";

/**
 * GET — what needs the trainee's attention in the arena and messages: unread course group chats, unread direct and cohort messages,
 * and a waiting challenge. `total` is the number for the app icon.
 */
export async function GET() {
  return arenaJson(async () => attentionOf(await arenaTrainee()));
}
