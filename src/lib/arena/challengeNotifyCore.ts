/** Ayakbi Arena challenge notifications: the wording and links, as pure functions. */
export interface ChallengeFacts { matchId: string; courseId: string; courseTitle: string; fromName: string; toName: string; topic: string | null; rematch: boolean }

export const CHALLENGE_TYPE = "ARENA_CHALLENGE";
export const CHALLENGE_REPLY_TYPE = "ARENA_CHALLENGE_REPLY";

/** What the challenged player gets. Tapping it opens the match, where they accept or decline. */
export function challengeNotice(f: ChallengeFacts) {
  const first = f.fromName.split(" ")[0] || "A coursemate";
  return {
    type: CHALLENGE_TYPE,
    title: f.rematch ? `${first} wants a rematch` : `${first} challenged you`,
    body: `${f.courseTitle}${f.topic ? ` · ${f.topic}` : ""}. Accept or decline in Ayakbi Arena.`,
    url: `/trainee/arena/match/${f.matchId}`,
  };
}

/** What the challenger gets when the other player answers. */
export function replyNotice(f: ChallengeFacts, accepted: boolean) {
  const first = f.toName.split(" ")[0] || "Your coursemate";
  return accepted
    ? { type: CHALLENGE_REPLY_TYPE, title: `${first} accepted your challenge`, body: `${f.courseTitle}. Join the match.`, url: `/trainee/arena/match/${f.matchId}` }
    : { type: CHALLENGE_REPLY_TYPE, title: `${first} declined your challenge`, body: `${f.courseTitle}. Try someone else or ask again later.`, url: `/trainee/arena/${f.courseId}` };
}
