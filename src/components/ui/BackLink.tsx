import { ChevronLeft } from "lucide-react";
import Icon from "./Icon";

/**
 * Replaces the raw `"← Back to X"` text pattern duplicated across ~16
 * pages. Deliberately distinct from BackButton.tsx — that's a
 * different UX pattern entirely (unlabeled icon-only button, fixed in
 * SiteHeader, `router.back()`-driven) and stays untouched. This is a
 * labeled, `href`-driven inline content link — a plain `<a>`, matching
 * every existing call site exactly (none of them used next/link's
 * <Link>), so this is a pure visual swap with no navigation-behavior
 * change bundled in.
 */
export default function BackLink({
  href,
  children,
  className = "text-xs font-semibold text-brand-teal hover:underline",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a href={href} className={`inline-flex items-center gap-1 ${className}`}>
      <Icon icon={ChevronLeft} size="sm" />
      {children}
    </a>
  );
}
