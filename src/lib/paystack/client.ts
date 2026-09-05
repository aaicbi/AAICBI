/**
 * M25 — calling Paystack's own /transaction/verify/:reference endpoint
 * after signature verification, before granting anything. Verified
 * directly against Paystack's current documentation before writing
 * this, not from memory: `GET /transaction/verify/:reference` with
 * `Authorization: Bearer <secret key>`.
 *
 * A distinction worth being precise about, since it's easy to get
 * wrong: the top-level `status` (boolean) is whether the API CALL
 * itself succeeded — a network/auth-level signal. `data.status`
 * (string: "success" | "failed" | "abandoned" | ...) is the actual
 * transaction outcome. Both need checking; a `status: true` response
 * with `data.status: "failed"` means the call worked fine and the
 * payment genuinely didn't succeed — value should never be granted in
 * that case, and this function's shape makes that failure mode
 * explicit rather than easy to miss.
 *
 * Honest note on what could and couldn't be verified while building
 * this: this calls a real external API this sandbox has no network
 * access to and no credentials for — written correctly against
 * Paystack's documented shape, the same "built correctly, not
 * verified end-to-end from here" category as this project's Google
 * Translate and Vercel Blob integrations.
 */
import { z } from "zod";

const VerifyResponseSchema = z.object({
  status: z.boolean(),
  message: z.string(),
  data: z.object({
    status: z.string(),
    reference: z.string(),
    amount: z.number(),
    // Audit finding, fixed here: originally checked amount alone, with
    // currency never verified at all — confirmed directly against a
    // dedicated guide on this exact Paystack integration risk, not
    // assumed: an amount of 1000 means something wildly different in
    // NGN kobo versus USD cents, and checking the number alone can't
    // tell them apart. `Course.priceKobo`'s own schema comment already
    // confirms NGN is the only currency this platform ever intends —
    // "500000" is never ambiguous on its own here, but the check
    // should say so explicitly rather than assume it.
    currency: z.string(),
    gateway_response: z.string().nullable(),
    paid_at: z.string().nullable(),
    // Needed for M26's activation step — recording who to bill again
    // later (M27), not required for the amount/status check above.
    customer: z.object({ customer_code: z.string() }).optional(),
    metadata: z.record(z.unknown()).nullable().optional(),
  }),
});
export type PaystackVerifyResult = z.infer<typeof VerifyResponseSchema>;

export async function verifyPaystackTransaction(reference: string): Promise<PaystackVerifyResult> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("PAYSTACK_SECRET_KEY is not set — see DEPLOYMENT.md. Required to verify any real transaction.");
  }

  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!res.ok) {
    throw new Error(`Paystack verify request failed: ${res.status} ${await res.text()}`);
  }

  const parsed = VerifyResponseSchema.safeParse(await res.json());
  if (!parsed.success) {
    throw new Error("Paystack verify response didn't match the expected shape.");
  }
  return parsed.data;
}

/**
 * The actual "should value be granted" decision, kept separate from
 * the network call above so it's genuinely unit testable without
 * mocking `fetch` — exactly the pattern the guide's own suggested test
 * scenarios (wrong amount, failed transaction, abandoned transaction)
 * call for. `expectedAmountKobo` matters as much as `data.status`
 * itself: a successful transaction for the WRONG amount is exactly as
 * dangerous as a failed one reported as successful, and is easy to
 * miss if only `data.status` is checked.
 *
 * Currency checked explicitly too, not just amount — the exact real
 * risk a dedicated guide on this specific Paystack pitfall describes:
 * an amount of 500000 is a wildly different real-world value in NGN
 * kobo versus, say, USD cents, and a numeric-only comparison can't
 * distinguish them. This platform only ever intends NGN — enforced
 * here, not just assumed from context.
 */
export function isGenuinePaymentSuccess(result: PaystackVerifyResult, expectedAmountKobo: number): boolean {
  return (
    result.status === true &&
    result.data.status === "success" &&
    result.data.amount === expectedAmountKobo &&
    result.data.currency === "NGN"
  );
}
