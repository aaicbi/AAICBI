"use client";

/** The one piece of interactivity the certificate page needs —
 * `window.print()` requires a client component, everything else on
 * that page is static server-rendered content. Browser print-to-PDF
 * is the certificate's "download" path (see the page's own comment
 * for why this project didn't build a server-side PDF pipeline for
 * M15 — a deliberate scope decision, not an oversight). */
export default function PrintCertificateButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg border border-brand-gray px-4 py-2 text-sm font-semibold text-gray-700 hover:border-brand-teal"
    >
      Print / Save as PDF
    </button>
  );
}
