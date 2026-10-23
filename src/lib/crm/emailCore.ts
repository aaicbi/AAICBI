/**
 * CRM email rules, pure (no database, no network), so every rule is tested. See docs/crm-email.md.
 *
 * What these rules guarantee: only approved, verified senders are used; a person who did not agree to a kind of message does not get it;
 * only allowlisted merge fields are filled in (values are escaped, never re-read as templates); the body is cleaned to a small set of tags
 * before it is stored or sent; and "accepted by the provider" is never shown as "delivered".
 */

export type Category = "SERVICE" | "MARKETING";
export const CATEGORY_LABEL: Record<Category, string> = { SERVICE: "Service message", MARKETING: "Marketing message" };

// ---------------------------------------------------------------------------------------------------------------------
// Merge fields

export interface MergeField { key: string; label: string; fallback: string }
export const MERGE_FIELDS: MergeField[] = [
  { key: "first_name", label: "First name", fallback: "there" },
  { key: "last_name", label: "Last name", fallback: "" },
  { key: "full_name", label: "Full name", fallback: "there" },
  { key: "course_name", label: "Course name", fallback: "your course" },
  { key: "cohort_name", label: "Cohort name", fallback: "your cohort" },
  { key: "application_reference", label: "Registration reference", fallback: "your reference" },
  { key: "application_status", label: "Registration status", fallback: "registered" },
  { key: "payment_status", label: "Payment status", fallback: "no payment due yet" },
  { key: "organisation_name", label: "Organisation name", fallback: "AAICBI" },
  { key: "assigned_staff_name", label: "Your name", fallback: "The AAICBI team" },
  { key: "support_email", label: "Support email", fallback: "" },
  { key: "course_start_date", label: "Course start date", fallback: "a date we will confirm soon" },
];
const FIELD_KEYS = new Set(MERGE_FIELDS.map((f) => f.key));
export type MergeData = Partial<Record<string, string | null | undefined>>;

const FIELD = /\{\{\s*([a-z_]+)\s*\}\}/g;

export const escapeHtml = (v: string): string => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Field names used in the text that are not on the allowlist (a typo, or someone trying to read something they should not). */
export function unknownFields(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/\{\{\s*([^{}]*?)\s*\}\}/g)) if (!FIELD_KEYS.has(m[1])) out.add(m[1]);
  return [...out];
}

/** Fills in the allowlisted fields in one pass. A missing value uses its safe fallback. Values are escaped for HTML and are never scanned again. */
export function renderMerge(text: string, data: MergeData, mode: "html" | "text"): string {
  const byKey = new Map(MERGE_FIELDS.map((f) => [f.key, f]));
  return text.replace(FIELD, (whole, key: string) => {
    const field = byKey.get(key);
    if (!field) return whole;
    const raw = (data[key] ?? "").toString().replace(/[\r\n]+/g, " ").trim();
    const value = raw || field.fallback;
    return mode === "html" ? escapeHtml(value) : value;
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Cleaning the body

const ALLOWED = new Set(["p", "br", "strong", "b", "em", "i", "u", "a", "ul", "ol", "li", "h2", "h3", "blockquote", "table", "thead", "tbody", "tr", "th", "td", "hr"]);
const RENAMED: Record<string, string> = { div: "p", h1: "h2", h4: "h3", h5: "h3", h6: "h3" };
const SAFE_HREF = /^(https?:\/\/|mailto:)/i;

/**
 * Reduces HTML to a small set of tags and attributes: no scripts, styles, forms, images, event handlers or odd link types. Only `href` on a link
 * survives, and only for http, https and mailto. Stray angle brackets in text are escaped. Safe to run twice.
 */
export function sanitizeHtml(input: string): string {
  let html = input.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style|iframe|object|embed|svg|math|form)\b[\s\S]*?<\/\1\s*>/gi, "");
  const parts: string[] = [];
  let last = 0;
  const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
  const text = (t: string) => t.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  for (const m of html.matchAll(TAG)) {
    parts.push(text(html.slice(last, m.index)));
    last = (m.index ?? 0) + m[0].length;
    const closing = m[1] === "/";
    let name = m[2].toLowerCase();
    name = RENAMED[name] ?? name;
    if (!ALLOWED.has(name)) continue;
    if (closing) { parts.push(`</${name}>`); continue; }
    if (name === "a") {
      const href = m[3].match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const value = (href?.[1] ?? href?.[2] ?? href?.[3] ?? "").trim().replace(/&amp;/g, "&");
      parts.push(value && SAFE_HREF.test(value) ? `<a href="${escapeHtml(value)}">` : "<a>");
    } else if (name === "br" || name === "hr") parts.push(`<${name}>`);
    else parts.push(`<${name}>`);
  }
  parts.push(text(html.slice(last)));
  return parts.join("").replace(/<(p|h2|h3|li|blockquote)>\s*<\/\1>/g, "").trim();
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

/** A plain-text version of the cleaned body, for mail apps that need it. Links keep their address in brackets. */
export function htmlToText(html: string): string {
  return html
    .replace(/<a href="([^"]*)">([\s\S]*?)<\/a>/g, (_m, href: string, label: string) => {
      const l = label.replace(/<[^>]+>/g, "").trim();
      const h = href.replace(/&amp;/g, "&");
      return !l || l === h ? h : `${l} (${h})`;
    })
    .replace(/<li>/g, "\n- ").replace(/<\/(p|h2|h3|blockquote|ul|ol|table)>/g, "\n\n").replace(/<br>|<\/tr>|<hr>/g, "\n").replace(/<\/t[dh]>/g, "  ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** A subject on one line, within a sensible length, so it cannot inject a header. */
export const cleanSubject = (s: string): string => s.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 150);

// ---------------------------------------------------------------------------------------------------------------------
// Sender and letterhead

export interface SenderInfo { name: string; fromAddress: string; replyTo: string | null; stream: string; verified: boolean; active: boolean; allowOrganizations: boolean }

const headerText = (s: string): string => s.replace(/[\r\n"<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);

/** The From header. A training organization sends as "<Organization> via <sender>" from the shared address. */
export function fromHeaderFor(sender: Pick<SenderInfo, "name" | "fromAddress">, organizationName: string | null): string {
  const label = organizationName ? `${headerText(organizationName)} via AAICBI` : headerText(sender.name);
  return `${label || "AAICBI"} <${sender.fromAddress}>`;
}

export interface LetterheadInput {
  bodyHtml: string;
  senderName: string;
  organisationName: string | null;
  category: Category;
  stopUrl: string;
  logoUrl: string;
}

/** The branded wrapper: the AAICBI header, the message, and a footer with why they are getting it and a stop link. Email-safe (inline styles). */
export function wrapLetterhead(i: LetterheadInput): string {
  const why = i.category === "MARKETING" ? "You are getting this because you agreed to receive news and offers." : "You are getting this because you registered for a course.";
  const stop = i.category === "MARKETING" ? "Unsubscribe" : "Stop messages";
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:24px;background:#F7F4EE;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;">
<div style="background:#016B61;padding:16px 24px;"><img src="${escapeHtml(i.logoUrl)}" alt="AAICBI" width="28" height="28" style="vertical-align:middle;margin-right:8px;border:0;" /><span style="font-size:13px;font-weight:bold;letter-spacing:0.05em;color:#ffffff;text-transform:uppercase;vertical-align:middle;">${escapeHtml(i.organisationName ? i.organisationName : "AAICBI")}</span></div>
<div style="padding:24px;font-size:15px;line-height:1.55;">${i.bodyHtml}</div>
<div style="border-top:1px solid #E4ECE8;padding:14px 24px;font-size:12px;color:#777;line-height:1.5;">${i.organisationName ? `Sent by ${escapeHtml(i.organisationName)} through AAICBI. ` : ""}Africa's AI Capacity Building Initiative · Futybills Tech Community · Uyo, Akwa Ibom State, Nigeria<br>${escapeHtml(why)} <a href="${escapeHtml(i.stopUrl)}" style="color:#777;">${stop}</a></div>
</div></body></html>`;
}

export function footerText(i: { organisationName: string | null; category: Category; stopUrl: string }): string {
  const why = i.category === "MARKETING" ? "You are getting this because you agreed to receive news and offers." : "You are getting this because you registered for a course.";
  return `\n\n--\n${i.organisationName ? `Sent by ${i.organisationName} through AAICBI. ` : ""}AAICBI · Futybills Tech Community · Uyo, Akwa Ibom State, Nigeria\n${why} ${i.category === "MARKETING" ? "Unsubscribe" : "Stop messages"}: ${i.stopUrl}`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Whether an email may be sent

export interface RecipientInfo { email: string; optedOutAt: Date | null; emailSuppressedAt: Date | null; followUpEmail: boolean; newsletter: boolean }
export type Verdict = { ok: true } | { ok: false; code: string; message: string };
const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

export function canSendEmail(i: { category: Category; recipient: RecipientInfo; sender: SenderInfo | null; viaOrganization: boolean }): Verdict {
  const { recipient: r, sender: s } = i;
  const no = (code: string, message: string): Verdict => ({ ok: false, code, message });
  if (!EMAIL.test(r.email)) return no("BAD_ADDRESS", "This person's email address is not valid.");
  if (r.optedOutAt) return no("OPTED_OUT", "This person asked us to stop all messages.");
  if (r.emailSuppressedAt) return no("SUPPRESSED", "Email to this address is switched off because an earlier email bounced or was reported as spam. Ask the person for a working address.");
  if (i.category === "SERVICE" && !r.followUpEmail) return no("NO_CONSENT", "This person did not agree to be contacted by email.");
  if (i.category === "MARKETING" && !r.newsletter) return no("NO_MARKETING_CONSENT", "This person did not agree to receive news and offers, so a marketing message cannot be sent to them. Send a service message instead, or choose someone who agreed.");
  if (!s) return no("NO_SENDER", "Choose a sender.");
  if (!s.active) return no("SENDER_OFF", "This sender is switched off.");
  if (!s.verified) return no("SENDER_UNVERIFIED", "This sender's domain is not confirmed as verified in Resend yet. A Super Admin must verify it first.");
  if (s.stream !== i.category) return no("WRONG_STREAM", i.category === "MARKETING" ? "Marketing messages must go from a marketing sender." : "Service messages must go from a service sender.");
  if (i.viaOrganization && !s.allowOrganizations) return no("ORG_NOT_ALLOWED", "Organizations cannot send from this address.");
  if (!i.viaOrganization && !s.replyTo) return no("NO_REPLY_TO", "Set a reply-to address for this sender first, so replies reach a real inbox.");
  return { ok: true };
}

export interface AttachmentInput { filename: string; size: number }
const ATT_EXT = new Set(["pdf", "png", "jpg", "jpeg", "docx", "xlsx", "pptx", "txt", "csv"]);
// Vercel accepts request bodies up to 4.5 MB, and files travel as base64 (a third bigger), so 3 MB of files is the most a send can carry.
export const ATT_MAX_EACH = 3 * 1024 * 1024;
export const ATT_MAX_TOTAL = 3 * 1024 * 1024;
export const ATT_MAX_COUNT = 3;

/** Attachments: a short list of safe types, 3 MB together. Returns the first problem, or null. */
export function attachmentProblem(list: AttachmentInput[]): string | null {
  if (list.length > ATT_MAX_COUNT) return `Attach at most ${ATT_MAX_COUNT} files.`;
  let total = 0;
  for (const a of list) {
    const ext = a.filename.split(".").pop()?.toLowerCase() ?? "";
    if (!ATT_EXT.has(ext)) return `"${a.filename}" is not an allowed file type. Use PDF, images, Word, Excel, PowerPoint, text or CSV.`;
    if (a.size > ATT_MAX_EACH) return `"${a.filename}" is over 3 MB.`;
    total += a.size;
  }
  return total > ATT_MAX_TOTAL ? "The attachments are over 3 MB together." : null;
}
export const safeFilename = (f: string): string => f.replace(/[\\/]/g, "_").replace(/[^\w.\- ]/g, "_").slice(0, 100) || "file";

// ---------------------------------------------------------------------------------------------------------------------
// What happened to it

export type EmailStatus = "DRAFT" | "SCHEDULED" | "SENDING" | "ACCEPTED" | "DELAYED" | "DELIVERED" | "BOUNCED" | "COMPLAINED" | "FAILED";
export const STATUS_LABEL: Record<EmailStatus, string> = {
  DRAFT: "Draft", SCHEDULED: "Scheduled", SENDING: "Sending", ACCEPTED: "Accepted by Resend", DELAYED: "Delivery delayed", DELIVERED: "Delivered",
  BOUNCED: "Bounced", COMPLAINED: "Reported as spam", FAILED: "Could not be sent",
};

/**
 * The status after a delivery report. Reports can arrive late or out of order, so a status never goes backwards: a delivery report does not
 * undo a bounce, and "sent" does not undo "delivered". A bounce or complaint always wins. Opens and clicks never change the status.
 */
export function statusAfterEvent(current: EmailStatus, type: string): EmailStatus {
  switch (type) {
    case "bounced": return "BOUNCED";
    case "complained": return "COMPLAINED";
    case "delivered": return current === "BOUNCED" || current === "COMPLAINED" ? current : "DELIVERED";
    case "delivery_delayed": return current === "ACCEPTED" || current === "SENDING" || current === "DELAYED" ? "DELAYED" : current;
    case "sent": return current === "SENDING" || current === "FAILED" || current === "SCHEDULED" ? "ACCEPTED" : current;
    default: return current;
  }
}

/** Whether an event should switch the address off: a permanent bounce, an undetermined one, or a spam complaint. A temporary bounce should not. */
export function suppressionFor(type: string, bounceType: string | null | undefined): "BOUNCE" | "COMPLAINT" | null {
  if (type === "complained") return "COMPLAINT";
  if (type === "bounced") return (bounceType ?? "").toLowerCase() === "transient" ? null : "BOUNCE";
  return null;
}
