"use client";
import { createContext, useContext } from "react";

/**
 * Admin sidebar pilot — lets SiteHeader know it's being rendered
 * inside a role area that now has its own persistent sidebar (see
 * src/app/admin/layout.tsx), so it can quietly render nothing instead
 * of duplicating navigation that already lives in that sidebar.
 *
 * Default is `false`, so every page that isn't wrapped by a provider
 * (every non-admin page today) renders SiteHeader exactly as before —
 * this is purely additive.
 */
const SidebarActiveContext = createContext(false);

export function SidebarActiveProvider({ children }: { children: React.ReactNode }) {
  return <SidebarActiveContext.Provider value={true}>{children}</SidebarActiveContext.Provider>;
}

export function useSidebarActive() {
  return useContext(SidebarActiveContext);
}
