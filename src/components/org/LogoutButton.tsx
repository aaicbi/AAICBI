"use client";

/**
 * Training Organizations, Phase 1 — same shape as every other role's
 * LogoutButton, minus NotificationBell (nothing yet produces a
 * notification for this role in Phase 1). Hard navigation after
 * logout, not router.push() — same reasoning as every other role's
 * LogoutButton this session already fixed: this page's own layout
 * (src/app/org/layout.tsx) is shared across every /org/* route, so a
 * client-side transition would leave it mounted with a stale session
 * check instead of re-running it fresh.
 */
export default function LogoutButton() {
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/org/login";
      }}
      className="rounded-lg border border-brand-gray px-3 py-2.5 text-sm font-semibold text-gray-600 hover:border-brand-teal"
    >
      Log out
    </button>
  );
}
