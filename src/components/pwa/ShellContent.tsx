"use client";
import SidebarBackBar from "@/components/SidebarBackBar";
import MobileBottomNav from "@/components/pwa/MobileBottomNav";
import type { NavRole } from "@/lib/pwa/mobileNav";

/**
 * The page area beside a role's sidebar. On large screens the sidebar is
 * the navigation; below that, a bottom navigation bar takes over, and the
 * page leaves room for it (the body is padded by --layer-nav, set by the bar
 * itself) so nothing ends up underneath it.
 */
export default function ShellContent({ role, moreItems, children }: { role: NavRole; moreItems: Array<{ label: string; href: string }>; children: React.ReactNode }) {
  return (
    <>
      <div className="lg:pl-64">
        <SidebarBackBar />
        {children}
      </div>
      <MobileBottomNav role={role} moreItems={moreItems} />
    </>
  );
}
