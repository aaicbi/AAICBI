"use client";
import { useRouter } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";

// Same reasoning as the employer/trainee versions of this component —
// see their own comments. Bug fix: the investor pages built in Phase 1
// imported the ADMIN LogoutButton, which redirects to /admin/login
// after logging out an investor — wrong destination. This is the real,
// investor-scoped one.
export default function LogoutButton() {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <NotificationBell />
      <button
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          router.push("/investor/login");
        }}
        className="rounded-lg border border-brand-gray px-3 py-2.5 text-sm font-semibold text-gray-600 hover:border-brand-teal"
      >
        Log out
      </button>
    </div>
  );
}
