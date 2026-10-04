"use client";

/**
 * Direct platform-fee billing — /org/billing is reached by a real,
 * authenticated session (the org's shadow ADMIN account) that
 * admin/layout.tsx has just redirected AWAY from the admin sidebar
 * (where logout normally lives), so this page needs its own way to log
 * out. Same shape as every other role's LogoutButton — hard navigation
 * after logout, not router.push(), so a fresh request re-runs every
 * page's own session check rather than leaving a stale one mounted.
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
