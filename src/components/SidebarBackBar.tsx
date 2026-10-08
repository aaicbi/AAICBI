"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import Icon from "@/components/ui/Icon";

/** Live exam and assessment screens lock navigation on purpose, so no way out is offered there. */
export function backBarHidden(pathname: string): boolean {
  const s = pathname.split("/").filter(Boolean);
  return s[0] === "exam" || s.includes("take");
}

/**
 * "Back" for pages inside a role's sidebar. The top header (which carries
 * the back arrow everywhere else) is switched off under a sidebar, so
 * these pages had no way back except the browser's. This sits at the top of
 * the page area, goes to the page you actually came from, and is left out
 * when there is nowhere to go back to.
 */
export default function SidebarBackBar() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [canGoBack, setCanGoBack] = useState(false);
  useEffect(() => {
    setCanGoBack(window.history.length > 1);
  }, [pathname]);
  if (!canGoBack || backBarHidden(pathname)) return null;
  return (
    <div className="px-4 pt-3 sm:px-6 print:hidden">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2 text-sm font-semibold text-gray-700 hover:bg-brand-mint hover:text-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
      >
        <Icon icon={ChevronLeft} size="md" />
        Back
      </button>
    </div>
  );
}
