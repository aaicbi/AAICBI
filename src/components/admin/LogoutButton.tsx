"use client";
import { useRouter } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";

// Same reasoning as the trainee version of this component — see its
// own comment.
//
// AdminQuickActionsNavMenu used to render here too (Phase 2), but once
// the admin sidebar pilot put every one of its shortcuts directly in
// the sidebar's own nav list, the dropdown was pure duplication —
// removed, along with the now-dead AdminQuickActionsNavMenu.tsx file.
export default function LogoutButton() {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      {/* align="left" — see NotificationBell.tsx's own comment: this
          renders inside the narrow admin sidebar now, not a wide top
          bar, so the dropdown needs to expand rightward, not leftward. */}
      <NotificationBell align="left" />
      <button
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          router.push("/admin/login");
        }}
        className="rounded-lg border border-brand-gray px-3 py-2.5 text-sm font-semibold text-gray-600 hover:border-brand-teal"
      >
        Log out
      </button>
    </div>
  );
}
