/**
 * Post-M15 milestone: certificates now require passing a course
 * examination, replacing the old "100% of modules complete" rule.
 * This is the one-time migration that ships with that change —
 * revokes every certificate that was issued under the old rule, since
 * none of them were earned by passing a course examination (course
 * examinations didn't exist yet when they were issued).
 *
 * Deliberate design decision, made explicitly rather than defaulted
 * to: existing certificates get REVOKED, not grandfathered in as
 * still-valid. The alternative — leaving old-rule certificates valid
 * forever — would mean two different, silently-coexisting definitions
 * of "AAICBI certified this person," which is worse for the
 * credential's actual meaning than a clean cutover.
 *
 * Safe to run more than once: only touches a certificate that is BOTH
 * currently un-revoked AND has no courseExamAttemptId — a certificate
 * genuinely earned under the new rule always has that link (see
 * certificates.ts's issuance logic), so this can never revoke a
 * legitimately-earned one, even if run again after real certificates
 * exist under the new rule. That's not a hypothetical concern to wave
 * away — it's the actual property that makes this safe to keep in the
 * repo rather than delete after one run.
 *
 * Run with:
 *   npm run db:revoke-legacy-certificates
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const candidates = await prisma.certificate.findMany({
    where: { revokedAt: null, courseExamAttemptId: null },
    select: {
      id: true,
      code: true,
      issuedAt: true,
      trainee: { select: { name: true, email: true } },
      course: { select: { title: true } },
    },
  });

  if (candidates.length === 0) {
    console.log("No certificates need revoking — nothing issued under the old rule remains un-revoked.");
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${candidates.length} certificate(s) issued under the old rule (pre-course-examination):\n`);
  for (const c of candidates) {
    console.log(`  ${c.code}  —  ${c.trainee.name} (${c.trainee.email})  —  "${c.course.title}"  —  issued ${c.issuedAt.toISOString()}`);
  }

  const now = new Date();
  const result = await prisma.certificate.updateMany({
    where: { id: { in: candidates.map((c: { id: string }) => c.id) } },
    data: { revokedAt: now },
  });

  console.log(`\nRevoked ${result.count} certificate(s) at ${now.toISOString()}.`);
  console.log("Each trainee's certificate page now shows as revoked. No notification was sent — this");
  console.log("matches the existing single-certificate revoke action's behavior (PATCH /api/certificates/[id]),");
  console.log("which also sends nothing today. Worth a deliberate decision before this runs against a real,");
  console.log("live cohort, not something this script should quietly decide on its own.");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
