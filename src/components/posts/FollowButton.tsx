"use client";
import { useState } from "react";
import { useSocial } from "@/components/posts/SocialProvider";

/** Follow or unfollow a profile. Visitors are asked to create an account first. */
export default function FollowButton({ profileId, initial, name, size = "sm" }: { profileId: string; initial: boolean; name: string; size?: "sm" | "md" }) {
  const { act } = useSocial();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    const res = await act("/api/follow", { method: on ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId }) });
    setBusy(false);
    if (res?.ok) setOn(!on);
  }
  return (
    <button type="button" onClick={toggle} disabled={busy} aria-pressed={on} aria-label={`${on ? "Unfollow" : "Follow"} ${name}`}
      className={`shrink-0 rounded-full border font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal disabled:opacity-60 ${size === "sm" ? "min-h-[36px] px-3.5 text-xs" : "min-h-[44px] px-5 text-sm"} ${on ? "border-brand-gray text-gray-700 hover:border-brand-rose hover:text-brand-rose" : "border-brand-teal text-brand-teal hover:bg-brand-mint"}`}>
      {on ? "Following" : "Follow"}
    </button>
  );
}
