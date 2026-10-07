import type { SVGProps } from "react";

/**
 * Custom brand icon. Certificate: a framed document with a seal and ribbon. For credentials and the certificate editor.
 * Drawn on the shared AAICBI grid: 24px box, 2px stroke, round caps and
 * joins, 2px minimum gap, currentColor so it follows the theme. Accepts
 * the same props as a lucide icon, so it works through ui/Icon.
 */
export default function CertificateIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M7 8.5h6M7 12h4" />
      <circle cx="17" cy="12.5" r="2" />
      <path d="M16 14.3l-.7 4.2 1.7-1 1.7 1-.7-4.2" />
    </svg>
  );
}
