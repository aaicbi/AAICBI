import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { canViewProfile } from "@/lib/profileVisibility";
import { ensureProfile, profileHref } from "@/lib/profiles/profiles";
import SiteHeader from "@/components/SiteHeader";

/**
 * The older address for a member's or staff member's profile. Each person now
 * has one address, /@handle, which shows the full profile, so this page only
 * sends the visitor there. It first applies the same visibility check the
 * profile itself uses, so a hidden profile is never confirmed to exist by
 * being redirected to: "doesn't exist" and "can't be seen" still look the same.
 */
export default async function LegacyProfileRedirect({ params }: { params: { username: string } }) {
  const viewer = await getSession();

  const trainee = await prisma.trainee.findUnique({ where: { username: params.username }, select: { id: true, profileVisibility: true } });
  if (trainee && (await canViewProfile(trainee.profileVisibility, trainee.id, "TRAINEE", viewer))) {
    const profile = await ensureProfile("PERSON", trainee.id);
    if (profile) redirect(profileHref(profile.handle));
  }

  const staff = trainee ? null : await prisma.user.findUnique({ where: { username: params.username }, select: { id: true, profileVisibility: true } });
  if (staff && (await canViewProfile(staff.profileVisibility, staff.id, "STAFF", viewer))) {
    const profile = await ensureProfile("STAFF", staff.id);
    if (profile) redirect(profileHref(profile.handle));
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-sm text-gray-600">This profile could not be found.</p>
      </main>
    </>
  );
}
