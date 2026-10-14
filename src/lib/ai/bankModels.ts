/**
 * Which Claude model does what in the question bank. One model WRITES the questions and a DIFFERENT model REVIEWS them, so a
 * question is never checked by the model that wrote it (the same model tends to repeat its own mistakes).
 *
 *  - Writer:   BANK_GENERATOR_MODEL (default claude-sonnet-5-5)
 *  - Reviewer: BANK_REVIEWER_MODEL  (default claude-opus-5-5): re-derives each answer from the lesson material blind,
 *              judges objective alignment and ambiguity, and runs the generation-time self-check.
 *
 * Both are read when used, not when the file loads, so tests can change them. If you set both to the same model the bank
 * still works but `independent` is false and the studio says so.
 */
import Anthropic from "@anthropic-ai/sdk";

export const DEFAULT_GENERATOR_MODEL = "claude-sonnet-5-5";
export const DEFAULT_REVIEWER_MODEL = "claude-opus-5-5";

export type BankRole = "generator" | "reviewer";

export function generatorModel(): string {
  return process.env.BANK_GENERATOR_MODEL?.trim() || DEFAULT_GENERATOR_MODEL;
}

export function reviewerModel(): string {
  return process.env.BANK_REVIEWER_MODEL?.trim() || DEFAULT_REVIEWER_MODEL;
}

export function bankModelInfo(): { generator: string; reviewer: string; independent: boolean } {
  const generator = generatorModel();
  const reviewer = reviewerModel();
  return { generator, reviewer, independent: generator !== reviewer };
}

/** A problem reaching Claude (not a problem with a question). Callers show the message and change nothing. */
export class BankModelError extends Error {}

const ENV_BY_ROLE: Record<BankRole, string> = { generator: "BANK_GENERATOR_MODEL", reviewer: "BANK_REVIEWER_MODEL" };

/**
 * Turns an Anthropic API failure into a plain message. Returns null for anything that is not an API failure (for example a
 * reply that could not be read), which the review code treats as "this question needs a person to look at it".
 */
export function asBankModelError(e: unknown, role: BankRole): BankModelError | null {
  if (!(e instanceof Anthropic.APIError)) return null;
  const model = role === "generator" ? generatorModel() : reviewerModel();
  const status = e.status;
  if (status === 404) {
    return new BankModelError(`The ${role} model "${model}" isn't available to your Anthropic account. Set ${ENV_BY_ROLE[role]} to a model you can use. Nothing was changed.`);
  }
  if (status === 401 || status === 403) {
    return new BankModelError("Anthropic refused the request: check that ANTHROPIC_API_KEY is valid and allowed to use this model. Nothing was changed.");
  }
  if (status === 429 || status === 529 || (typeof status === "number" && status >= 500)) {
    return new BankModelError("Claude is busy or unavailable right now. Nothing was changed; try again in a minute.");
  }
  return new BankModelError(`The ${role} model "${model}" could not run (${e.message}). Nothing was changed.`);
}
