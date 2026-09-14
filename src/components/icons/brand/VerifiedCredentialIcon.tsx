import type { SVGProps } from "react";

/**
 * Custom brand icon — for this platform's actual differentiator: a
 * publicly, independently verifiable certificate (certificate/[code]
 * page, QR-code verification). Deliberately NOT a generic checkmark or
 * shield — a seal/rosette shape (an official stamp, not a security
 * badge) so "verified credential" reads as visually distinct from
 * every other plain success-checkmark in the app.
 */
export default function VerifiedCredentialIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 2h8l6 6v8l-6 6H8l-6-6V8z" />
      <path d="M8.5 12l2.5 2.5L16 9" />
    </svg>
  );
}
