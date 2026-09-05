import { NextResponse } from "next/server";

/**
 * Every admin API route follows the same shape: try the handler, and if
 * requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR") or anything else throws an Error with a `.status`, turn
 * it into the matching JSON response instead of a raw 500. Keeps route
 * files free of repetitive try/catch boilerplate.
 */
export function withApiErrors(handler: () => Promise<NextResponse>): Promise<NextResponse> {
  return handler().catch((e: unknown) => {
    const err = e as Error & { status?: number; code?: string };

    // M11 audit finding, defense-in-depth: the specific delete routes
    // this project protects data with (modules, questions, exams — see
    // deletionGuards.ts) now pre-check for a foreign-key conflict and
    // throw a friendly, specific 409 before Postgres ever sees the
    // DELETE. This is the fallback for any OTHER path that might hit
    // the same underlying constraint without a matching pre-check —
    // duck-typed on Prisma's error code (`P2003` = foreign key
    // violation) rather than `instanceof Prisma.PrismaClientKnownRequestError`,
    // since this sandbox's blocked `prisma generate` step means
    // `@prisma/client`'s generated exports aren't reliably resolvable
    // here (see the README's "Note on prisma generate") — duck-typing
    // works identically in a normal environment and doesn't depend on
    // that being fixed first.
    if (err.code === "P2003") {
      return NextResponse.json(
        {
          error:
            "Can't complete this — other records still depend on it. If you were trying to delete something, that's usually real trainee data (an attempt, an answer) protecting itself from being silently lost.",
        },
        { status: 409 }
      );
    }

    // Prisma's `findUniqueOrThrow`/`findFirstOrThrow` raise P2025
    // ("record not found") when a required row genuinely isn't there.
    // By far the most common real cause on this project is a stale
    // session: a valid, correctly-signed JWT whose userId points at an
    // account that no longer exists in the current database — e.g.
    // after the DB was re-seeded while a browser still held its old
    // login cookie. requireRole accepts the token (it's
    // cryptographically valid), then the very next
    // `prisma.user.findUniqueOrThrow({ where: { id: session.userId } })`
    // finds nothing and, without this, surfaces an ugly prisma:error
    // 500 to someone who is simply logged in as a user that got wiped.
    //
    // Returned as 404 with a message that fits either cause — a wiped
    // session account OR a link to a record (a trainee, an exam) that
    // has since been deleted — deliberately NOT 401 "sign in again",
    // because that would misdescribe the second case (an admin opening
    // a deleted trainee hasn't lost their own session). The client can
    // treat 404 on a self-scoped settings call as "re-authenticate"
    // and 404 on a detail page as "this is gone" — the status is
    // honest for both, where a blanket 401 would lie about one of them.
    //
    // A proper 500 is still avoided (no false alarm in logs), while a
    // genuine data-integrity bug would show up as an unexpected 404
    // rather than being silently swallowed. Same duck-typed-on-code
    // approach as P2003 above, for the same reason (blocked `prisma
    // generate` in this sandbox); works identically in a normal
    // environment. Central, so all ~16 routes that can hit this get
    // the clean behaviour at once with no per-file change.
    if (err.code === "P2025") {
      return NextResponse.json(
        { error: "That record could not be found. It may have been removed, or your session may have expired — try signing in again." },
        { status: 404 }
      );
    }

    const status = err.status ?? 500;
    if (status === 500) {
      console.error(err);
    }
    return NextResponse.json(
      { error: err.message || "Something went wrong." },
      { status }
    );
  });
}
