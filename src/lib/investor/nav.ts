/**
 * Sidebar rollout (Phase 2) — the one canonical investor nav list,
 * replacing a single-item array literal inlined three times across
 * `src/app/investor/**` (same drift-prevention reasoning as admin/
 * trainee/employer's own nav.ts files).
 *
 * Both links always show, unlike the inlined original which hid
 * "Investment Opportunities" from a not-yet-approved investor —
 * that's still enforced where it matters (the dashboard page itself
 * redirects a PENDING/REJECTED investor to /investor/status), so the
 * sidebar link leading there is harmless, just no longer hidden.
 */
export const INVESTOR_NAV = [
  { label: "Investment Opportunities", href: "/investor/dashboard" },
  { label: "Account", href: "/investor/status" },
];
