"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import Icon from "./ui/Icon";

/**
 * Rendered from SiteHeader itself rather than added to each page
 * individually — SiteHeader is already the one header every real page
 * in the app renders (74 of 78 page.tsx files at the time this was
 * added; the four exceptions are the live exam/assessment-taking
 * screens, which deliberately lock down navigation so a trainee can't
 * accidentally leave mid-attempt, and one legacy redirect stub — none
 * of which should grow a back button anyway). One component, every
 * page gets it, nothing to remember to add per page going forward.
 *
 * Plain browser history (`router.back()`), not a hardcoded "go to the
 * parent route" guess — this app's nesting doesn't always match the
 * URL structure closely enough for that to be reliable, and history
 * already reflects the exact page the person actually came from.
 *
 * Hidden when there's no real history to go back to (a fresh tab, a
 * bookmarked or externally-linked landing) — a back button that goes
 * nowhere useful is worse than no button. `window.history.length` is a
 * standard, if imperfect, proxy for that; checked client-side only
 * (useEffect) since `window` doesn't exist during server rendering and
 * checking any earlier would risk a hydration mismatch.
 */
export default function BackButton() {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    setCanGoBack(window.history.length > 1);
  }, []);

  if (!canGoBack) return null;

  return (
    <button
      onClick={() => router.back()}
      aria-label="Go back"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-brand-mint hover:text-brand-teal"
    >
      <Icon icon={ChevronLeft} size="md" />
    </button>
  );
}
