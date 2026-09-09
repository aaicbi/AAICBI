import { redirect } from "next/navigation";

/**
 * Settings-page redesign — this standalone route is kept alive (no
 * dead link for anyone with it bookmarked) but its content has moved:
 * what used to be one flat "Platform Settings" page is now three
 * properly-separated, role-gated categories inside /admin/settings
 * itself — Payments, Security, and Integrations (see that page and
 * PaymentsSettingsPanel/SecuritySettingsPanel/IntegrationsPanel).
 *
 * A plain redirect rather than keeping a second, combined view of the
 * same fields alive here — maintaining two presentations of one
 * underlying PlatformSettings resource is exactly the kind of drift
 * risk this whole redesign was meant to remove, not reintroduce.
 */
export default function PlatformSettingsRedirectPage() {
  redirect("/admin/settings");
}
