/**
 * Reads the JSON a Claude model was asked to return. Models sometimes wrap it in a sentence or a code fence, or get cut off
 * part-way through a long answer; any of those used to make the whole reply unreadable. This takes what is there:
 *  1. the whole reply, if it is JSON;
 *  2. the outermost {...} inside it, if there is text around it;
 *  3. a cut-off reply trimmed back to its last complete element and closed, so the questions that did arrive are kept.
 */

function stripFences(text: string): string {
  return text.replace(/```(?:json)?/gi, "").trim();
}

function tryParse(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** The closing brackets needed to finish `prefix`, or null when the prefix ends inside a string. */
function closersFor(prefix: string): string | null {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (const ch of prefix) {
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") stack.pop();
  }
  return inString ? null : stack.reverse().join("");
}

/** Trims a cut-off reply back to its last complete element and closes it. Returns undefined when nothing can be saved. */
export function repairTruncatedJson(text: string): unknown | undefined {
  const start = text.indexOf("{");
  if (start < 0) return undefined;
  const body = text.slice(start);
  let attempts = 0;
  for (let i = body.length - 1; i > 0 && attempts < 80; i--) {
    if (body[i] !== "}" && body[i] !== "]") continue;
    attempts++;
    const prefix = body.slice(0, i + 1);
    const closers = closersFor(prefix);
    if (closers === null) continue;
    const parsed = tryParse(prefix + closers);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

export interface JsonRead {
  value: unknown | undefined;
  /** True when the reply had to be trimmed because it was cut off. */
  repaired: boolean;
}

export function readJsonReply(raw: string): JsonRead {
  const text = stripFences(raw);
  const whole = tryParse(text);
  if (whole !== undefined) return { value: whole, repaired: false };
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) {
    const inner = tryParse(text.slice(first, last + 1));
    if (inner !== undefined) return { value: inner, repaired: false };
  }
  const repaired = repairTruncatedJson(text);
  return { value: repaired, repaired: repaired !== undefined };
}
