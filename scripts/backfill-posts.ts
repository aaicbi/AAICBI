/**
 * Copies the earlier educational videos into the unified post model, and the earlier organization follows into the follow graph. Safe to
 * run again: videos already copied are skipped.
 *   npx tsx scripts/backfill-posts.ts
 */
import { backfillFollows, backfillPostsFromEducation } from "../src/lib/posts/backfill";
import { prisma } from "../src/lib/prisma";

backfillPostsFromEducation()
  .then(async (r) => {
    console.log(`Posts: ${r.total} videos in a settled state, copied ${r.copied}, updated ${r.updated}, already up to date ${r.skipped}`);
    const f = await backfillFollows();
    console.log(`Follows: ${f.total} organization follows, copied ${f.copied}`);
  })
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
