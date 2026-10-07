export const metadata = { title: { default: "Organization", template: "%s · Organization · AAICBI" } };

/**
 * Training Organizations — /org/register and /org/login are the only
 * routes left under /org/* (Phase 2 retired the bespoke /org/dashboard
 * in favor of reusing /admin/dashboard directly, see training-org-login's
 * own comment), both pre-auth pages that already render their own plain
 * SiteHeader. This layout is now a pass-through for that reason, not a
 * simplification of something still in use.
 */
export default function OrgLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
