/**
 * Turns a question into comparable words. Everything here is plain string
 * work with no framework imports, so the same code runs in the browser
 * (where the guide answers) and in tests.
 *
 * Steps: lowercase and strip accents; rewrite a few multi-word phrases
 * ("sign in", "sign up", "forgot password") into single words; split into
 * words; drop filler words; trim plural and "-ing"/"-ed" endings; and map
 * words that mean the same thing here (course, program, training, class)
 * onto one concept word, so "any classes for data?" finds the answer
 * written about "programs".
 */

const PHRASES: Array<[RegExp, string]> = [
  [/\b(?:forgot|forgotten|reset|lost|recover|change)\b(?:\s+\w+){0,3}?\s+password\b/g, " resetpassword "],
  [/\b(?:sign|log)\s*in\b/g, " login "],
  [/\bsignin\b/g, " login "],
  [/\b(?:sign\s*up|signup|create\s+(?:an\s+|my\s+|a\s+)?account|open\s+(?:an\s+|my\s+|a\s+)?account|register)\b/g, " register "],
  [/\bopen\s+day\b/g, " event "],
  [/\blearning\s+buddy\b/g, " buddy "],
];

const STOP = new Set(
  (
    "a an the and or but if so of to in on at by for from with without about as into onto over under up down out off " +
    "is are was were be been being am do does did done have has had having can could would should will shall may might must " +
    "i me my mine we us our ours your yours he she it its they them their this that these those there here " +
    "which whom whose when where why how whether any some all each every more most much many few take part " +
    "please pls help need want wanna like looking look find show tell give get got go going let lets ask asking know " +
    "hi hello hey thanks thank ok okay yes no not just also too very really still then than " +
    "guide someone something anything everything one ones way thing things"
  ).split(/\s+/),
);

/** Words that mean the same thing here, by the concept word they map to. */
/**
 * Words that carry meaning only when nothing else does: "what is this
 * platform?" and "who are you?" are made of nothing else. They are dropped
 * whenever a question has other meaningful words.
 */
export const WEAK = new Set(["what", "who", "you", "platform", "site", "website", "web", "app", "application", "ecosystem", "aaicbi", "loop", "name"]);

const CONCEPTS: Record<string, string[]> = {
  training: ["train", "course", "program", "programme", "class", "learn", "study", "lesson", "bootcamp", "curriculum", "upskill", "teach", "tutorial"],
  job: ["job", "role", "vacancy", "opening", "opportunity", "opportunit", "internship", "intern", "career", "position", "employment"],
  organization: ["organization", "organisation", "org", "academy", "institute", "institution", "school", "provider", "college", "trainer"],
  trainee: ["trainee", "student", "learner", "graduate", "talent", "candidate"],
  employer: ["employer", "company", "recruiter", "business", "firm", "hire", "hiring", "recruit", "recruitment"],
  investor: ["investor", "invest", "investment", "funding", "fund", "funder", "pitch", "venture"],
  certificate: ["certificate", "certification", "credential", "verify", "verification", "certified", "diploma", "badge"],
  event: ["event", "workshop", "webinar", "meetup", "seminar", "conference"],
  video: ["video", "clip", "watch", "youtube", "recording"],
  message: ["message", "chat", "dm", "contact", "reach", "talk", "email", "mail", "speak"],
  price: ["price", "pric", "cost", "fee", "pay", "payment", "free", "cheap", "afford", "paid", "naira", "charge", "expensive"],
  exam: ["exam", "examination", "test", "quiz", "assessment", "assignment", "grade"],
  privacy: ["privacy", "private", "public", "visible", "visibility"],
  register: ["register", "registration", "join", "subscribe"],
  resetpassword: ["resetpassword", "password"],
};

const CONCEPT_OF = new Map<string, string>();
for (const [concept, words] of Object.entries(CONCEPTS)) for (const w of words) CONCEPT_OF.set(w, concept);

function stem(word: string): string {
  let w = word;
  if (w.length > 4 && w.endsWith("ies")) w = w.slice(0, -3) + "y";
  else if (w.length > 4 && w.endsWith("sses")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) w = w.slice(0, -1);
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  return w;
}

export function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Lowercased words with phrases rewritten, before filler removal or stemming. */
export function rawWords(text: string): string[] {
  let t = ` ${stripAccents(text).toLowerCase()} `;
  for (const [re, to] of PHRASES) t = t.replace(re, to);
  return t.split(/[^a-z0-9+#.]+/).map((w) => w.replace(/^[.]+|[.]+$/g, "")).filter(Boolean);
}

/** The meaningful words of a question, as concept words where one applies. */
export function tokens(text: string): string[] {
  const strong: string[] = [];
  const weak: string[] = [];
  for (const w of rawWords(text)) {
    if (STOP.has(w)) continue;
    const isWeak = WEAK.has(w);
    const s = stem(w);
    if (s.length < 2) continue;
    const concept = CONCEPT_OF.get(w) ?? CONCEPT_OF.get(s) ?? s;
    (isWeak ? weak : strong).push(concept);
  }
  return strong.length > 0 ? strong : weak;
}

/** A stable comparison form of a whole question: used to group repeated unanswered questions. */
export function normalizeQuestion(text: string): string {
  return rawWords(text).filter((w) => !STOP.has(w)).map(stem).sort().join(" ");
}

export { CONCEPTS, STOP };
