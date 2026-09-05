/**
 * M14 — the one file that talks to an email provider, same house rule
 * as extractQuestions.ts and analyzePerformance.ts state for
 * themselves: a provider swap only touches this file.
 *
 * Provider decision, documented the same way Voyage AI was for M11's
 * embeddings: Resend, chosen for a Vercel-deployed project (this
 * project's own recommended target — see the deployment guide) because
 * it needs no SMTP setup, has a real free tier (3,000 emails/month,
 * plenty for a single training org's cohort sizes), and its API is a
 * single HTTP call with a small, typed SDK — no new infrastructure
 * beyond an API key. Sending real mail from a real domain needs that
 * domain verified in Resend's dashboard; without one, Resend's shared
 * `onboarding@resend.dev` sender works for testing but will look like
 * a test sender to recipients — fine for development, not for a real
 * cohort. See .env.example for what to set before this goes live.
 *
 * Graceful degradation, same pattern as every other external call in
 * this project: no RESEND_API_KEY configured → skip and log, never
 * throw. A missing notification is a worse-but-survivable outcome; a
 * broken registration/password-reset/exam-submission flow because an
 * email provider hiccupped is not.
 *
 * M14 audit finding: that graceful-degradation promise only held for
 * an outright FAILURE, not a HANG. Checked the Resend SDK's own type
 * definitions directly — unlike the Anthropic SDK (which M13 gives an
 * explicit 15-second ceiling), Resend exposes no client-level timeout
 * option at all. A slow or hung request here used to just block
 * whatever called it indefinitely — the calling flow's own try/catch
 * doesn't help, because a hang isn't a thrown exception, it's just
 * waiting. That's a real problem beyond the one-shot auth routes: the
 * module-unlocked hook (progress.ts) runs inside getModuleLockMap(),
 * which fires on ordinary trainee course page views — a hung Resend
 * call there could stall a page load, not just a registration
 * response. Fixed with an explicit timeout race below, the same
 * pattern the missing SDK option should have provided.
 */
import { Resend } from "resend";

let client: Resend | null = null;
function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

const EMAIL_SEND_TIMEOUT_MS = 10_000;

/** Bounds how long we'll wait for `promise`, without attempting to
 * cancel the underlying request — the goal is only to stop OUR code
 * from hanging, not to abort Resend's in-flight HTTP call, which the
 * SDK gives no way to do anyway.
 *
 * M14 audit finding: the first version of this left its `setTimeout`
 * running for the full `ms` duration even after `promise` settled
 * first — the normal, fast-path case, every single time. Harmless in
 * effect (it just fires later against an already-resolved race and
 * does nothing), but a real dangling-timer hygiene issue under any
 * real send volume. Cleared properly now, on whichever side wins. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailResult {
  ok: boolean;
  error?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const resend = getClient();
  if (!resend) {
    return { ok: false, error: "RESEND_API_KEY is not set — email sending is disabled." };
  }

  // M14 audit finding: every other missing-optional-config case in
  // this project (VOYAGE_API_KEY, ANTHROPIC_API_KEY) fails VISIBLY —
  // the feature is skipped and a warning is logged. A missing APP_URL
  // is quieter and worse: the email still sends "successfully," it
  // just contains a link pointing at http://localhost:3000 that no
  // real recipient can reach — nothing about the send looks broken
  // from the app's side. Warned here, at the one point that knows both
  // "we are actually about to send a real email" (resend is
  // configured, we're past the check above) and "the link in it is
  // probably wrong."
  if (!process.env.APP_URL) {
    console.warn(
      "APP_URL is not set — this email's links point to http://localhost:3000, which real recipients can't reach. Set APP_URL before sending real notifications (see .env.example)."
    );
  }

  const from = process.env.EMAIL_FROM || "AAICBI <onboarding@resend.dev>";

  try {
    const result = await withTimeout(
      resend.emails.send({ from, to: input.to, subject: input.subject, html: input.html, text: input.text }),
      EMAIL_SEND_TIMEOUT_MS
    );
    if (result.error) {
      return { ok: false, error: result.error.message };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error sending email." };
  }
}
