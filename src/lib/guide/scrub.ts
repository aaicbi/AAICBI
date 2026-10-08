/**
 * Prepares a question the guide could not answer for the team's queue.
 * Only the words are kept, and anything that identifies a person is
 * replaced before storage: email addresses, links, phone numbers and other
 * long runs of digits. Returns null when there is nothing worth keeping.
 */
export function scrubQuestion(input: string): string | null {
  if (typeof input !== "string") return null;
  let t = input.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  t = t.replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g, "[email]");
  t = t.replace(/\b(?:https?:\/\/|www\.)\S+/g, "[link]");
  t = t.replace(/\+?\d[\d\s().-]{5,}\d/g, "[number]");
  t = t.replace(/\d{5,}/g, "[number]");
  t = t.replace(/\s+/g, " ").trim().slice(0, 200).trim();
  const letters = t.replace(/\[[a-z]+\]/g, "").replace(/[^a-z]/g, "");
  if (letters.length < 3) return null;
  return t;
}
