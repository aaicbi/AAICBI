import type { SVGProps } from "react";

/**
 * Custom brand icon — for payments/pricing/access and subscriptions. A
 * card plus a small recurring-cycle badge overlapping its corner, so
 * it reads specifically as "recurring/subscription billing" rather
 * than a one-off card-payment glyph — matches how this app's own
 * billing model actually works (recurring subscription access, per
 * Course.accessModel).
 */
export default function PaymentsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="6" width="16" height="13" rx="2" />
      <path d="M3 10h16" />
      <path d="M17 15a2.5 2.5 0 1 1 2.5 2.5" />
      <path d="M20.5 15.5l1 2-2 .5" />
    </svg>
  );
}
