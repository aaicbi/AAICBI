/**
 * Ayakbi Arena real-time layer, the pure part: channel names and what a browser may do on them.
 *
 * Browsers only ever SUBSCRIBE. Every message is sent by our server after it has checked the rules, so
 * nobody can forge a score or a reaction by talking to the real-time service directly. Messages carry no
 * answers and no private details; they only tell the page "something changed, fetch the latest", and the
 * server then sends each person only what they are allowed to see.
 */
export const CHANNEL_PREFIX = "aaicbi:arena";

export const channels = {
  /** One person's own invitations and notices. */
  user: (traineeId: string) => `${CHANNEL_PREFIX}:user:${traineeId}`,
  /** Everyone enrolled in a course: challenges and match start notices. */
  course: (courseId: string) => `${CHANNEL_PREFIX}:course:${courseId}`,
  /** The players of one match. */
  match: (matchId: string) => `${CHANNEL_PREFIX}:match:${matchId}`,
  /** Spectators of one match (added when watching is built). */
  watch: (matchId: string) => `${CHANNEL_PREFIX}:watch:${matchId}`,
  /** Used only by the Super Admin connection test. */
  ping: () => `${CHANNEL_PREFIX}:ping`,
} as const;

export type Capability = Record<string, ("subscribe" | "history")[]>;

/** What a signed-in trainee may listen to. Subscribe only, nothing else, on a short list of channels. */
export function capabilityFor(input: { traineeId: string; courseIds: string[]; matchIds: string[]; watchIds?: string[] }): Capability {
  const cap: Capability = { [channels.user(input.traineeId)]: ["subscribe"] };
  for (const id of input.courseIds.slice(0, 50)) cap[channels.course(id)] = ["subscribe"];
  for (const id of input.matchIds.slice(0, 20)) cap[channels.match(id)] = ["subscribe"];
  for (const id of (input.watchIds ?? []).slice(0, 20)) cap[channels.watch(id)] = ["subscribe"];
  return cap;
}

/** Token lifetime. The page asks again before it runs out. */
export const TOKEN_TTL_MS = 60 * 60 * 1000;

export interface PokeMessage {
  /** The match or course version, so a page can ignore an old poke that arrives late. */
  v: number;
  /** Optional short hint such as "challenge" or "ready", for the page to react quickly. Never private data. */
  k?: string;
}
