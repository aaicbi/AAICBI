/**
 * M11 duplicate detection — the one genuinely new piece of logic this
 * milestone adds (per the roadmap). Two halves:
 *
 *  1. Turning question text into a vector (this file, via Voyage AI).
 *  2. Comparing that vector against a module's existing bank (also
 *     here, via a raw pgvector query) and deciding "close enough to
 *     flag" (src/lib/embeddingsCore.ts — the pure, testable half).
 *
 * ---------------------------------------------------------------------
 * Provider decision, documented the same way the M10 video-hosting call
 * was: Claude/Anthropic models don't serve an embeddings endpoint, so
 * this needed a second provider regardless of choice. Voyage AI is
 * Anthropic's own recommended embeddings partner, and `voyage-3-lite`
 * is priced at $0.02 per 1M tokens — importing a 60-question document
 * (a few thousand tokens) costs a small fraction of a cent, and it's a
 * ONE-TIME cost at import, not a per-attempt or per-trainee cost. Same
 * shape as the "random sampling at attempt time is a DB query, not an
 * AI call" principle elsewhere in M11: the cost scales with how many
 * questions an instructor uploads, never with how many trainees take
 * the assessment.
 *
 * Graceful degradation, on purpose: if VOYAGE_API_KEY isn't set, every
 * function here returns null/skips rather than throwing. Duplicate
 * detection is a nice-to-have quality check, not a blocker — an
 * instructor without that key configured can still import questions,
 * they just don't get the duplicate flag (the import route surfaces
 * `duplicateCheckSkipped: true` so the admin UI can say so plainly
 * rather than silently doing less than it looks like it's doing).
 * ---------------------------------------------------------------------
 */
import { prisma } from "@/lib/prisma";
import { cosineSimilarity, findClosestDuplicate } from "@/lib/embeddingsCore";

const VOYAGE_MODEL = "voyage-3-lite";
// voyage-3-lite's default output dimension. Asserted at runtime below
// rather than just assumed — if Voyage ever changes this model's
// default, silently writing a different-length vector into a
// vector(512) column would fail loudly at the database level anyway,
// but catching it here gives a much clearer error message.
const EXPECTED_DIMENSION = 512;

export function embeddingsEnabled(): boolean {
  return !!process.env.VOYAGE_API_KEY;
}

/**
 * Embeds a batch of question texts in one Voyage API call (cheaper and
 * faster than one call per question). Returns null — not a throw — if
 * the API key is missing or the call fails, so a failed/unconfigured
 * embeddings step never takes down a DOCX import that would otherwise
 * succeed. Logs the reason once so it's visible in server logs without
 * being surfaced to the trainee-facing (or even admin-facing) response
 * as a hard error.
 */
export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    console.warn(
      "VOYAGE_API_KEY is not set — skipping duplicate-question detection for this import. " +
        "See src/lib/embeddings.ts for what this costs and why it's optional."
    );
    return null;
  }
  if (texts.length === 0) return [];

  try {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input: texts, model: VOYAGE_MODEL }),
    });
    if (!res.ok) {
      console.error(`Voyage AI embeddings request failed: ${res.status} ${await res.text()}`);
      return null;
    }
    const data = (await res.json()) as { data: { embedding: number[]; index: number }[] };
    const ordered = [...data.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);

    for (const vec of ordered) {
      if (vec.length !== EXPECTED_DIMENSION) {
        console.error(
          `Voyage AI returned a ${vec.length}-dimension embedding, expected ${EXPECTED_DIMENSION}. ` +
            `The database column is vector(${EXPECTED_DIMENSION}) — skipping duplicate detection for this import rather than writing a mismatched vector.`
        );
        return null;
      }
    }
    return ordered;
  } catch (e) {
    console.error("Voyage AI embeddings request threw:", e);
    return null;
  }
}

/** The text a question is embedded from: the question stem plus its
 * options, since two questions can have identical stems with different
 * (or shuffled) options and shouldn't necessarily be flagged, and vice
 * versa a reworded stem with the same options is still worth catching. */
export function embeddingSourceText(questionText: string, optionTexts: string[]): string {
  return [questionText, ...optionTexts].join(" | ");
}

/**
 * Writes an embedding onto an existing Question row via raw SQL — the
 * Prisma client has no typed API for the `vector` column (see the
 * schema comment on Question.embedding). The vector literal is built
 * from numbers this process computed itself (Voyage's response), never
 * from user-supplied text, so string-building it directly is safe; the
 * question id is still passed as a proper bound parameter.
 *
 * Accepts an optional `client` (a Prisma transaction handle) so this
 * can run inside the same atomic transaction as the question's own
 * `create` — see the M11 audit fix in the import route's own comment
 * for why that matters (a mid-import failure used to leave a partial,
 * un-rolled-back bank behind).
 */
interface RawSqlCapable {
  $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<unknown>;
}

export async function saveQuestionEmbedding(
  questionId: string,
  embedding: number[],
  client: RawSqlCapable = prisma
): Promise<void> {
  const literal = toVectorLiteral(embedding);
  await client.$executeRawUnsafe(
    `UPDATE "Question" SET embedding = '${literal}'::vector WHERE id = $1`,
    questionId
  );
}

/**
 * Fetches every existing embedding in a module's assessment bank (i.e.
 * every Question under the given examId that already has one stored).
 * Read as text and parsed in JS rather than compared inside SQL — bank
 * sizes here are small by design (the roadmap's own guidance: "40-60
 * questions is plenty for a first cohort"), so pulling them all into
 * Node and running cosineSimilarity() in embeddingsCore.ts is simpler
 * and just as fast as reaching for pgvector's `<=>` operator and an
 * ivfflat/hnsw index, which only start mattering at a bank size this
 * project isn't targeting yet. Revisit if a bank grows into the
 * thousands.
 *
 * Called exactly ONCE per import (see findDuplicatesForBatch below) —
 * an earlier version of this file called it once per question, which
 * meant re-fetching and re-parsing the same growing bank on every
 * iteration of a 60-question import. Fixed in the same audit pass that
 * fixed the "one Voyage call per question" issue below; both were the
 * same underlying mistake (doing per-item work that should have been
 * done once for the whole batch).
 */
interface BankEmbeddingRow {
  id: string;
  text: string;
  embedding: string;
}

export async function fetchBankEmbeddings(
  examId: string
): Promise<{ questionId: string; text: string; embedding: number[] }[]> {
  // Not using $queryRawUnsafe's own generic type parameter here — see
  // the README's "Note on prisma generate": in this sandbox, the
  // Prisma client's generated types (including $queryRawUnsafe's
  // signature) aren't available, so `tsc` can't resolve a type
  // argument on it at all. Casting the awaited result instead gets the
  // same end type safety in a normal environment (where the generic
  // form works fine) without failing to compile here.
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT id, text, embedding::text as embedding FROM "Question" WHERE "examId" = $1 AND embedding IS NOT NULL`,
    examId
  )) as BankEmbeddingRow[];
  return rows.map((r) => ({ questionId: r.id, text: r.text, embedding: parseVectorLiteral(r.embedding) }));
}

export interface DuplicateMatch {
  similarity: number;
  matchedQuestionId: string | null; // null when the match is against another question earlier in THIS SAME import, which doesn't have a database id yet at check time
  matchedQuestionText: string;
}

/**
 * The main entry point the import route calls, ONCE, for an entire
 * batch of newly-extracted questions — not once per question. This
 * replaces an earlier version (`checkForDuplicate`) that embedded and
 * compared one question at a time; that function's own doc comment
 * claimed batching was the point of `embedTexts()`, but the calling
 * code never actually batched anything, so a 60-question import made
 * 60 separate Voyage HTTP round-trips. Audit finding, fixed here: one
 * `embedTexts()` call for the whole batch, one `fetchBankEmbeddings()`
 * call for the existing bank, and the duplicate comparison itself runs
 * entirely in memory (embeddingsCore.ts) with no further network or
 * database round-trips per question.
 *
 * Still catches within-batch duplicates (question 40 of a 60-question
 * document duplicating question 12 of the same document), the same way
 * the old per-question version did: each new question is compared
 * against the existing bank PLUS every new question already processed
 * earlier in this same call, via a running in-memory list.
 *
 * Never throws — if Voyage is unreachable or unconfigured, every
 * result comes back with no match, exactly like before.
 */
export async function findDuplicatesForBatch(
  examId: string,
  questions: { questionText: string; optionTexts: string[] }[]
): Promise<{ embeddings: (number[] | null)[]; matches: (DuplicateMatch | null)[] }> {
  const noMatches = { embeddings: questions.map(() => null), matches: questions.map(() => null) };
  if (questions.length === 0) return noMatches;

  const sourceTexts = questions.map((q) => embeddingSourceText(q.questionText, q.optionTexts));
  const embedded = await embedTexts(sourceTexts); // ONE Voyage call for the whole batch
  if (!embedded) return noMatches; // unconfigured or failed — degrade gracefully, same as before

  const bank = await fetchBankEmbeddings(examId); // ONE database round-trip
  const running: { questionId: string | null; text: string; embedding: number[] }[] = bank.map((b) => ({
    questionId: b.questionId,
    text: b.text,
    embedding: b.embedding,
  }));

  const matches: (DuplicateMatch | null)[] = [];
  for (let i = 0; i < questions.length; i++) {
    const embedding = embedded[i];
    const candidates = running.map((r) => ({ item: r, similarity: cosineSimilarity(embedding, r.embedding) }));
    const closest = findClosestDuplicate(candidates);
    matches.push(
      closest
        ? {
            similarity: closest.similarity,
            matchedQuestionId: closest.item.questionId,
            matchedQuestionText: closest.item.text,
          }
        : null
    );
    // Append AFTER comparing, so a question never matches itself, but
    // DOES become a candidate for every later question in this batch —
    // this is what catches a within-document duplicate.
    running.push({ questionId: null, text: questions[i].questionText, embedding });
  }

  return { embeddings: embedded, matches };
}

function toVectorLiteral(embedding: number[]): string {
  const values = embedding.map((n) => {
    if (!Number.isFinite(n)) throw new Error("Embedding contains a non-finite value — refusing to write it.");
    return n;
  });
  return `[${values.join(",")}]`;
}

function parseVectorLiteral(text: string): number[] {
  // pgvector's ::text cast returns "[0.1,0.2,...]" — strip the brackets and split.
  return text
    .slice(1, -1)
    .split(",")
    .map(Number);
}
