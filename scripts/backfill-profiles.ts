/**
 * Gives every existing account a profile (and so a /@handle). Safe to run
 * again: accounts that already have one are skipped.
 *   npx tsx scripts/backfill-profiles.ts
 */
import { backfillProfiles, removeShadowStaffProfiles } from "../src/lib/profiles/profiles";
import { prisma } from "../src/lib/prisma";

removeShadowStaffProfiles().then((n) => n && console.log(`Removed ${n} shadow staff profile(s)`)).then(() => backfillProfiles())
  .then((r) => console.log(`Profiles: ${r.total} accounts, ${r.existing} already had one, created ${JSON.stringify(r.created)}`))
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
