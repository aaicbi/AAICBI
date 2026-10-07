"use client";
import { useEffect } from "react";

function send(body: object) {
  fetch("/api/ecosystem/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true }).catch(() => {});
}

/** Counts one visit to an organization page per browser session; failures are ignored. */
export function ProfileViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `eco-profile:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* storage blocked — still count once per mount */
    }
    send({ type: "PROFILE_VIEW", slug });
  }, [slug]);
  return null;
}

/** Wraps a program link; a click is counted without delaying or changing the navigation. */
export function ProgramClick({ courseId, postId, children }: { courseId: string; postId?: string; children: React.ReactNode }) {
  return <span onClickCapture={() => send({ type: "PROGRAM_CLICK", courseId, postId })}>{children}</span>;
}
