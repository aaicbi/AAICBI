"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import MobileBottomNav from "@/components/pwa/MobileBottomNav";
import { pageHasSidebar } from "@/lib/sidebarRoutes";
import type { ShellInfo } from "@/lib/pwa/shell";

/**
 * Keeps the bottom navigation with a signed-in person on pages outside their
 * own area (events, jobs, organizations, notifications, public profiles),
 * where the role layouts do not apply. Inside a role area the layout
 * already renders it, so this stays out of the way there. Signed-out
 * visitors never see it.
 */
export default function GlobalBottomNav() {
  const pathname = usePathname() ?? "/";
  const [shell, setShell] = useState<ShellInfo | null>(null);
  const insideRoleArea = pageHasSidebar(pathname);

  useEffect(() => {
    if (insideRoleArea) return;
    let live = true;
    fetch("/api/pwa/shell", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setShell(d?.shell ?? null))
      .catch(() => live && setShell(null));
    return () => {
      live = false;
    };
  }, [insideRoleArea, pathname]);

  if (insideRoleArea || !shell) return null;
  return <MobileBottomNav role={shell.role} moreItems={shell.moreItems} />;
}
