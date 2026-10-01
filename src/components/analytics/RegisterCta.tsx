"use client";
import Button from "@/components/ui/Button";
import { trackVisitorEvent } from "@/lib/analytics/visitorTrackClient";

/**
 * Analytics System Phase 2 — the "started registration" signal the
 * conversion funnel needs. A thin client wrapper around the shared
 * Button specifically so it can be dropped into a SERVER-component
 * parent (the landing page) that otherwise has no onClick handler to
 * attach — a plain inline onClick works fine on pages that are already
 * client components (e.g. the public course detail page), which don't
 * need this wrapper.
 */
export default function RegisterCta({
  href,
  variant,
  size,
  className,
  children,
}: {
  href: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Button href={href} variant={variant} size={size} className={className} onClick={() => trackVisitorEvent({ type: "REGISTER_CLICKED" })}>
      {children}
    </Button>
  );
}
