import * as Ably from "ably";
import { capabilityFor, channels, TOKEN_TTL_MS, type PokeMessage } from "@/lib/arena/realtimeCore";

/**
 * Ayakbi Arena real-time layer. Ably is the provider; everything goes through the small functions below so
 * the provider can be swapped without touching the game. With no ABLY_API_KEY the arena still works: pages
 * simply check for changes every second or two ("polling mode"). The key stays on the server and browsers
 * only ever receive short-lived tokens that let them subscribe to the channels they are allowed on.
 */
let rest: Ably.Rest | null | undefined;

function client(): Ably.Rest | null {
  if (rest !== undefined) return rest;
  const key = process.env.ABLY_API_KEY?.trim();
  rest = key ? new Ably.Rest({ key }) : null;
  return rest;
}

export const realtimeMode = (): "ably" | "poll" => (client() ? "ably" : "poll");

/** Tell everyone on a channel that something changed. Never throws: the game works without it (pages also poll). */
export async function poke(channel: string, message: PokeMessage): Promise<boolean> {
  const c = client();
  if (!c) return false;
  try {
    await c.channels.get(channel).publish("poke", message);
    return true;
  } catch (e) {
    console.error("[arena] real-time publish failed:", e instanceof Error ? e.message : e);
    return false;
  }
}

export async function pokeMany(list: { channel: string; message: PokeMessage }[]): Promise<void> {
  await Promise.all(list.map((p) => poke(p.channel, p.message)));
}

/**
 * A short-lived Ably token for one trainee: subscribe-only, on their own channel, their courses' arenas and their current match.
 * The browser listens over a plain event stream (no Ably library shipped to phones); the key never leaves the server.
 */
export async function tokenFor(input: { traineeId: string; courseIds: string[]; matchIds: string[]; watchIds?: string[] }) {
  const c = client();
  if (!c) return null;
  const capability = capabilityFor(input);
  const details = await c.auth.requestToken({ clientId: input.traineeId, capability: JSON.stringify(capability), ttl: TOKEN_TTL_MS });
  return { token: details.token, expires: details.expires, channels: Object.keys(capability) };
}

/** Super Admin connection test: send a message and read it back from Ably's history. */
export async function selfTest(): Promise<{ mode: "ably" | "poll"; ok: boolean; message: string }> {
  const c = client();
  if (!c) return { mode: "poll", ok: true, message: "No Ably key is set, so the arena runs in polling mode: pages check for changes every second or two. Add ABLY_API_KEY to switch to instant updates." };
  try {
    const stamp = `test-${Date.now()}`;
    const ch = c.channels.get(channels.ping());
    await ch.publish("test", { stamp });
    await new Promise((r) => setTimeout(r, 400));
    const page = await ch.history({ limit: 5 });
    const found = page.items.some((m) => (m.data as { stamp?: string } | null)?.stamp === stamp);
    return found
      ? { mode: "ably", ok: true, message: "Connected to Ably. A test message was sent and read back." }
      : { mode: "ably", ok: false, message: "The key works for sending but the test message could not be read back. Check that the key allows History." };
  } catch (e) {
    return { mode: "ably", ok: false, message: `Ably refused the request: ${e instanceof Error ? e.message : "unknown error"}. Check the key's permissions and channel restriction (aaicbi:*).` };
  }
}
