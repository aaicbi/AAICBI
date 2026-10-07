"use client";
import { useEffect } from "react";

/** Counts one view per browser session; failures are ignored. */
export default function ViewBeacon({ postId }: { postId: string }) {
  useEffect(() => {
    const key = `edu-view:${postId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* storage blocked — still count once per mount */
    }
    fetch(`/api/education-posts/${postId}/view`, { method: "POST" }).catch(() => {});
  }, [postId]);
  return null;
}
