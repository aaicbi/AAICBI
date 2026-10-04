import { headers } from "next/headers";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/org/LogoutButton";

const ORG_NAV = [{ label: "Dashboard", href: "/org/dashboard" }];

/**
 * Training Organizations, Phase 1 — deliberately NOT a sidebar
 * (unlike every other role this session converted — see the plan's own
 * "Explicitly deferred to Phase 2" section). Phase 1's org dashboard is
 * a single, minimal, read-mostly page; a whole sidebar system for one
 * page would be overbuilt. /org/login and /org/register keep their
 * plain SiteHeader (no nav/right) the same way every other role's
 * pre-auth pages do — this layout only adds the nav+logout chrome on
 * every OTHER /org/* route.
 *
 * This is chrome only — src/app/org/dashboard/page.tsx still does its
 * own getSession()-then-redirect() check, the real security boundary,
 * same discipline as every other role's pages.
 */
export default async function OrgLayout({ children }: { children: React.ReactNode }) {
  const pathname = headers().get("x-pathname") ?? "";
  const segments = pathname.split("/").filter(Boolean);
  const isPreAuth = segments[1] === "login" || segments[1] === "register";

  if (isPreAuth) {
    return <>{children}</>;
  }

  return (
    <>
      <SiteHeader nav={ORG_NAV} right={<LogoutButton />} />
      {children}
    </>
  );
}
