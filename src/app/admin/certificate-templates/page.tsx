import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";

/**
 * Training Organizations, Phase 2 — the org-facing entry point into the
 * certificate design tool, a thin id-less alias of
 * /admin/training-organizations/[id]/certificate-templates (which is
 * fully generic on its own org id param and has no SUPER_ADMIN-specific
 * UI). A training org's own staff ADMIN session has no reason to know
 * its own organization's id to type into a URL, so this resolves it via
 * the same shadow-staff-account lookup the admin sidebar/billing gate
 * already use and redirects straight to the real page.
 *
 * Not reachable usefully by a real AAICBI staff member — SUPER_ADMIN
 * already reaches certificate templates via Training Organizations →
 * pick an org, and a plain staff ADMIN/INSTRUCTOR has no "own"
 * organization to redirect to — both just land back on the dashboard.
 */
export default async function CertificateTemplatesEntryPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    redirect("/admin/dashboard");
  }
  const org = await findTrainingOrgByStaffUserId(session.userId);
  if (!org) {
    redirect("/admin/dashboard");
  }
  redirect(`/admin/training-organizations/${org.id}/certificate-templates`);
}
