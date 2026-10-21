import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import OrgTeamManager from "@/components/org/OrgTeamManager";
import OrgActivityList from "@/components/org/OrgActivityList";
import Card from "@/components/ui/Card";
import { resolveOrgActor } from "@/lib/org/actor";
import { ROLE_HELP, ROLE_LABEL } from "@/lib/org/people";

export const metadata = { title: "Team" };

/** Organization-only: invite and manage teammates. Everything is scoped to the signed-in organization on the server. */
export default async function OrganizationTeamPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/admin/dashboard");
  const org = await findTrainingOrgByStaffUserId(session.userId);
  if (!org) redirect("/admin/dashboard");

  const actor = await resolveOrgActor(org, session.email).catch(() => null);
  const manages = !!actor && (actor.role === "OWNER" || actor.role === "MANAGER");

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Organization", href: "/admin/organization" }, { label: "Team" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Team</h1>
      <p className="mt-1 text-sm text-gray-600">Invite colleagues to help run {org.name} on AAICBI.</p>
      {actor && <p className="mt-2 text-sm text-gray-700">You are signed in as <strong>{actor.name}</strong>, {ROLE_LABEL[actor.role].toLowerCase()}. {ROLE_HELP[actor.role]}</p>}
      {manages ? (
        <>
          <div className="mt-6"><OrgTeamManager /></div>
          <OrgActivityList />
        </>
      ) : (
        <Card className="mt-6"><p className="text-sm text-gray-700">Only the owner or an admin can manage the team and see the activity.</p></Card>
      )}
    </main>
  );
}
