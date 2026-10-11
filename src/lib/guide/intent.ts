/**
 * What the person wants from their question, so Loop can answer in the
 * right shape:
 *   info     "What is Analytics?"            explain
 *   navigate "Where is Analytics?"           offer a button that takes them there
 *   instruct "How do I use Analytics?"       step-by-step answer
 *   demo     "Show me how to use Analytics"  guided walkthrough that lights up the controls
 *   action   "Open Analytics"                go there now (when allowed)
 * Plain phrase rules, no AI service.
 */
export type Intent = "info" | "navigate" | "instruct" | "demo" | "action";

export interface IntentResult {
  intent: Intent;
  /** The question with the asking words removed ("analytics"). */
  subject: string;
}

const ACTION = /^(?:please\s+)?(?:(?:can|could|will)\s+you\s+)?(?:open|go\s+to|take\s+me\s+to|take\s+me|bring\s+me\s+to|navigate\s+to|launch|visit|jump\s+to|head\s+to)\s+/;
const DEMO = /^(?:please\s+)?(?:(?:can|could)\s+you\s+)?(?:show\s+me(?:\s+how(?:\s+to)?)?|walk\s+me\s+through|guide\s+me(?:\s+through)?|demonstrate|give\s+me\s+a\s+(?:tour|demo|walkthrough)\s+of|tour)\s+/;
const NAVIGATE = /^(?:please\s+)?(?:where(?:'s|\s+is|\s+are|\s+can\s+i\s+(?:find|see|get|open|go)|\s+do\s+i\s+(?:find|see|go|open|get)|\s+would\s+i\s+find)|how\s+do\s+i\s+(?:get|go)\s+to|which\s+page\s+(?:has|is)|find\s+me)\s+/;
const INSTRUCT = /^(?:please\s+)?(?:how\s+(?:do|can|would|should|could)\s+(?:i|we|you)|how\s+to|what\s+are\s+the\s+steps\s+to|steps\s+to|what\s+is\s+the\s+way\s+to|i\s+(?:want|need)\s+to|help\s+me)\s+/;
const INFO = /^(?:what(?:'s|\s+is|\s+are|\s+does)|who\s+(?:is|are)|explain|tell\s+me\s+about|define|why)\s+/;

const clean = (s: string) => s.toLowerCase().replace(/[?!.]+$/g, "").replace(/\s+/g, " ").trim();
const stripLead = (s: string) => s.replace(/^(?:the|my|a|an|your)\s+/, "").replace(/\s+(?:page|section|screen|tab)$/, "").trim();

export function classifyIntent(question: string): IntentResult {
  const q = clean(question);
  const take = (re: RegExp, intent: Intent): IntentResult | null => {
    const m = q.match(re);
    return m ? { intent, subject: stripLead(q.slice(m[0].length)) } : null;
  };
  return take(DEMO, "demo") ?? take(ACTION, "action") ?? take(NAVIGATE, "navigate") ?? take(INSTRUCT, "instruct") ?? take(INFO, "info") ?? { intent: "info", subject: stripLead(q) };
}


/** "Show me everything I can open", "site map", "what pages are there": the person wants the whole map, not one place. */
const MAP_REQUEST = /\b(?:site\s*map|sitemap|all\s+(?:the\s+)?pages|every\s+page|list\s+(?:of\s+)?(?:all\s+)?(?:the\s+)?pages|what\s+pages|which\s+pages|everything\s+(?:i|we)\s+can\s+(?:open|do|go\s+to|see|access)|where\s+can\s+i\s+go|(?:map|menu|directory)\s+of\s+(?:the\s+)?(?:platform|site|website)|navigate\s+the\s+(?:platform|site|website)|everything\s+on\s+(?:the\s+)?(?:platform|site|website))\b/;
export const isMapRequest = (question: string): boolean => MAP_REQUEST.test(clean(question));
