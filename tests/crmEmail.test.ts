import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import {
  attachmentProblem, canSendEmail, cleanSubject, escapeHtml, fromHeaderFor, htmlToText, renderMerge, safeFilename, sanitizeHtml, statusAfterEvent, suppressionFor,
  unknownFields, verifyWebhook, wrapLetterhead, type RecipientInfo, type SenderInfo,
} from "@/lib/crm/emailCore";

const recipient: RecipientInfo = { email: "amaka@example.com", optedOutAt: null, emailSuppressedAt: null, followUpEmail: true, newsletter: false };
const sender: SenderInfo = { name: "AAICBI Admissions", fromAddress: "admissions@mail.aaicbi.org", replyTo: "admissions@aaicbi.org", stream: "SERVICE", verified: true, active: true, allowOrganizations: true };
const can = (o: Partial<Parameters<typeof canSendEmail>[0]> = {}) => canSendEmail({ category: "SERVICE", recipient, sender, viaOrganization: false, ...o });

describe("merge fields", () => {
  it("fills allowlisted fields and falls back when one is empty", () => {
    expect(renderMerge("Hi {{first_name}}, {{ course_name }}", { first_name: "Amaka", course_name: "AI" }, "text")).toBe("Hi Amaka, AI");
    expect(renderMerge("Hi {{first_name}}", {}, "text")).toBe("Hi there");
    expect(renderMerge("Hi {{first_name}}", { first_name: "  " }, "text")).toBe("Hi there");
    expect(renderMerge("{{support_email}}", {}, "text")).toBe("");
  });
  it("escapes values in HTML and never reads them as templates", () => {
    expect(renderMerge("{{first_name}}", { first_name: "<b>x</b>" }, "html")).toBe("&lt;b&gt;x&lt;/b&gt;");
    expect(renderMerge("{{first_name}}", { first_name: "{{course_name}}", course_name: "SECRET" }, "text")).toBe("{{course_name}}");
    expect(renderMerge("{{first_name}}", { first_name: "a\nb" }, "text")).toBe("a b");
  });
  it("leaves unknown fields alone and reports them", () => {
    expect(renderMerge("{{password}}", { password: "x" }, "text")).toBe("{{password}}");
    expect(unknownFields("Hi {{first_name}} {{password}} {{ trainee_email }}")).toEqual(["password", "trainee_email"]);
  });
});

describe("cleaning the body", () => {
  it("keeps simple formatting", () => {
    expect(sanitizeHtml("<p>Hi <strong>you</strong></p><ul><li>a</li></ul>")).toBe("<p>Hi <strong>you</strong></p><ul><li>a</li></ul>");
  });
  it("removes scripts, styles, forms, images, handlers and attributes", () => {
    const out = sanitizeHtml('<p onclick="x()" style="color:red">Hi</p><script>alert(1)</script><style>p{}</style><img src=x onerror=alert(1)><iframe src="//e"></iframe><form><input></form>');
    expect(out).toBe("<p>Hi</p>");
  });
  it("allows only safe link types", () => {
    expect(sanitizeHtml('<a href="https://aaicbi.org/x?a=1&b=2">go</a>')).toContain('href="https://aaicbi.org/x?a=1&amp;b=2"');
    expect(sanitizeHtml('<a href="javascript:alert(1)">go</a>')).toBe("<a>go</a>");
    expect(sanitizeHtml('<a href="data:text/html,x">go</a>')).toBe("<a>go</a>");
    expect(sanitizeHtml('<a href=" JaVaScRiPt:alert(1)">go</a>')).toBe("<a>go</a>");
    expect(sanitizeHtml('<a href="mailto:a@b.com">m</a>')).toContain('href="mailto:a@b.com"');
  });
  it("turns divs into paragraphs, escapes stray brackets and is safe to run twice", () => {
    expect(sanitizeHtml("<div>a</div>")).toBe("<p>a</p>");
    expect(sanitizeHtml("a < b and c > d")).toBe("a &lt; b and c &gt; d");
    const once = sanitizeHtml('<p>x &amp; y</p><a href="https://a.b/?q=1&z=2">l</a>');
    expect(sanitizeHtml(once)).toBe(once);
  });
  it("makes a readable plain-text version", () => {
    const t = htmlToText('<p>Hi &amp; welcome</p><ul><li>One</li><li>Two</li></ul><p><a href="https://aaicbi.org">Open</a></p>');
    expect(t).toContain("Hi & welcome");
    expect(t).toContain("- One\n- Two");
    expect(t).toContain("Open (https://aaicbi.org)");
  });
  it("keeps a subject on one line", () => {
    expect(cleanSubject("Hello\r\nBcc: x@y.com")).toBe("Hello Bcc: x@y.com");
    expect(cleanSubject("a".repeat(400)).length).toBe(150);
  });
});

describe("the From header and letterhead", () => {
  it("shows the sender, or the organization via AAICBI, from the same address", () => {
    expect(fromHeaderFor(sender, null)).toBe("AAICBI Admissions <admissions@mail.aaicbi.org>");
    expect(fromHeaderFor(sender, "Northwind Academy")).toBe("Northwind Academy via AAICBI <admissions@mail.aaicbi.org>");
  });
  it("cannot be used to inject a header", () => {
    const h = fromHeaderFor(sender, 'Evil"\r\nBcc: x@y.com <a@b.c>');
    expect(h).not.toMatch(/[\r\n]/);
    expect(h.endsWith("<admissions@mail.aaicbi.org>")).toBe(true);
    expect(h.match(/</g)?.length).toBe(1);
  });
  it("wraps the message with a footer and a stop link", () => {
    const html = wrapLetterhead({ bodyHtml: "<p>Hi</p>", senderName: "x", organisationName: "Northwind <Academy>", category: "SERVICE", stopUrl: "https://aaicbi.org/crm/optout/abc", logoUrl: "https://aaicbi.org/logo.svg" });
    expect(html).toContain("<p>Hi</p>");
    expect(html).toContain("Stop messages");
    expect(html).toContain("Northwind &lt;Academy&gt;");
    expect(html).not.toContain("<Academy>");
    expect(wrapLetterhead({ bodyHtml: "", senderName: "x", organisationName: null, category: "MARKETING", stopUrl: "u", logoUrl: "l" })).toContain("Unsubscribe");
  });
});

describe("whether an email may be sent", () => {
  it("allows a service message to someone who agreed to follow-up", () => expect(can().ok).toBe(true));
  it("refuses people who opted out, bounced or never agreed", () => {
    expect(can({ recipient: { ...recipient, optedOutAt: new Date() } })).toMatchObject({ ok: false, code: "OPTED_OUT" });
    expect(can({ recipient: { ...recipient, emailSuppressedAt: new Date() } })).toMatchObject({ ok: false, code: "SUPPRESSED" });
    expect(can({ recipient: { ...recipient, followUpEmail: false } })).toMatchObject({ ok: false, code: "NO_CONSENT" });
    expect(can({ recipient: { ...recipient, email: "nope" } })).toMatchObject({ ok: false, code: "BAD_ADDRESS" });
  });
  it("blocks marketing unless they ticked the newsletter, and from the wrong stream", () => {
    expect(can({ category: "MARKETING" })).toMatchObject({ ok: false, code: "NO_MARKETING_CONSENT" });
    expect(can({ category: "MARKETING", recipient: { ...recipient, newsletter: true } })).toMatchObject({ ok: false, code: "WRONG_STREAM" });
    expect(can({ category: "MARKETING", recipient: { ...recipient, newsletter: true }, sender: { ...sender, stream: "MARKETING" } }).ok).toBe(true);
  });
  it("refuses a sender that is unverified, switched off or missing a reply-to", () => {
    expect(can({ sender: { ...sender, verified: false } })).toMatchObject({ ok: false, code: "SENDER_UNVERIFIED" });
    expect(can({ sender: { ...sender, active: false } })).toMatchObject({ ok: false, code: "SENDER_OFF" });
    expect(can({ sender: { ...sender, replyTo: null } })).toMatchObject({ ok: false, code: "NO_REPLY_TO" });
    expect(can({ sender: null })).toMatchObject({ ok: false, code: "NO_SENDER" });
  });
  it("lets an organization send only from addresses that allow it, and needs no sender reply-to for it", () => {
    expect(can({ viaOrganization: true, sender: { ...sender, replyTo: null } }).ok).toBe(true);
    expect(can({ viaOrganization: true, sender: { ...sender, allowOrganizations: false } })).toMatchObject({ ok: false, code: "ORG_NOT_ALLOWED" });
  });
});

describe("attachments", () => {
  it("allows a few safe files within the size limits", () => {
    expect(attachmentProblem([{ filename: "a.pdf", size: 1000 }, { filename: "b.PNG", size: 1000 }])).toBeNull();
    expect(attachmentProblem([{ filename: "a.exe", size: 10 }])).toMatch(/not an allowed/);
    expect(attachmentProblem([{ filename: "a.pdf", size: 6 * 1024 * 1024 }])).toMatch(/over 5 MB/);
    expect(attachmentProblem([1, 2, 3, 4].map((n) => ({ filename: `${n}.pdf`, size: 1 })))).toMatch(/at most 3/);
    expect(attachmentProblem([1, 2, 3].map((n) => ({ filename: `${n}.pdf`, size: 4 * 1024 * 1024 })))).toMatch(/8 MB/);
  });
  it("cleans file names", () => {
    expect(safeFilename("../../etc/passwd")).toBe(".._.._etc_passwd");
    expect(safeFilename("")).toBe("file");
  });
});

describe("delivery status", () => {
  it("moves forward and never backwards", () => {
    expect(statusAfterEvent("SENDING", "sent")).toBe("ACCEPTED");
    expect(statusAfterEvent("ACCEPTED", "delivered")).toBe("DELIVERED");
    expect(statusAfterEvent("DELIVERED", "sent")).toBe("DELIVERED");
    expect(statusAfterEvent("DELIVERED", "delivery_delayed")).toBe("DELIVERED");
    expect(statusAfterEvent("ACCEPTED", "delivery_delayed")).toBe("DELAYED");
    expect(statusAfterEvent("DELAYED", "delivered")).toBe("DELIVERED");
  });
  it("lets a bounce or complaint win, even after delivery, and a delivery never undoes one", () => {
    expect(statusAfterEvent("DELIVERED", "bounced")).toBe("BOUNCED");
    expect(statusAfterEvent("DELIVERED", "complained")).toBe("COMPLAINED");
    expect(statusAfterEvent("BOUNCED", "delivered")).toBe("BOUNCED");
  });
  it("does not change the status on opens and clicks", () => {
    expect(statusAfterEvent("DELIVERED", "opened")).toBe("DELIVERED");
    expect(statusAfterEvent("ACCEPTED", "clicked")).toBe("ACCEPTED");
  });
  it("switches an address off for permanent bounces and complaints only", () => {
    expect(suppressionFor("bounced", "Permanent")).toBe("BOUNCE");
    expect(suppressionFor("bounced", "Undetermined")).toBe("BOUNCE");
    expect(suppressionFor("bounced", "Transient")).toBeNull();
    expect(suppressionFor("complained", null)).toBe("COMPLAINT");
    expect(suppressionFor("delivered", null)).toBeNull();
  });
});

describe("webhook signature", () => {
  const secretBytes = Buffer.from("super-secret-key-for-the-test-1234");
  const secret = `whsec_${secretBytes.toString("base64")}`;
  const body = JSON.stringify({ type: "email.delivered", data: { email_id: "e1" } });
  const now = 1_800_000_000_000;
  const ts = String(Math.floor(now / 1000));
  const sign = (id: string, t: string, b: string) => `v1,${createHmac("sha256", secretBytes).update(`${id}.${t}.${b}`).digest("base64")}`;
  const ok = (over: Record<string, unknown> = {}) => verifyWebhook({ id: "msg_1", timestamp: ts, signatureHeader: sign("msg_1", ts, body), body, secret, nowMs: now, ...over } as Parameters<typeof verifyWebhook>[0]);
  it("accepts a correct signature, including among several", () => {
    expect(ok()).toBe(true);
    expect(ok({ signatureHeader: `v1,AAAA ${sign("msg_1", ts, body)}` })).toBe(true);
  });
  it("rejects a changed body, wrong id, wrong secret, old timestamp or missing parts", () => {
    expect(ok({ body: body + " " })).toBe(false);
    expect(ok({ id: "msg_2" })).toBe(false);
    expect(ok({ secret: `whsec_${Buffer.from("other").toString("base64")}` })).toBe(false);
    expect(ok({ nowMs: now + 10 * 60 * 1000 })).toBe(false);
    expect(ok({ signatureHeader: null })).toBe(false);
    expect(ok({ secret: "" })).toBe(false);
    expect(ok({ signatureHeader: "v2,abc" })).toBe(false);
  });
});

describe("escaping", () => {
  it("escapes the five dangerous characters", () => expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;"));
});
