/**
 * Copies the earlier educational videos into the unified post model. Safe to
 * run again: videos already copied are skipped.
 *   npx tsx scripts/backfill-posts.ts
 */
import { backfillPostsFromEducation } from "../src/lib/posts/backfill";
import { prisma } from "../src/lib/prisma";

backfillPostsFromEducation()
  .then((r) => console.log(`Posts: ${r.total} videos in a settled state, copied ${r.copied}, already copied or skipped ${r.skipped}`))
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
