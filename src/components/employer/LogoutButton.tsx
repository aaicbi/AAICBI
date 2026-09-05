"use client";
import { useRouter } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";

// Same reasoning as the trainee version of this component — see its
// own comment.
export default function LogoutButton() {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <NotificationBell />
      <button
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          router.push("/employer/login");
        }}
        className="rounded-lg border border-brand-gray px-3 py-2.5 text-sm font-semibold text-gray-600 hover:border-brand-teal"
      >
        Log out
      </button>
    </div>
  );
}
