"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

/** On a course page: a way into the course chat, shown only when the chat is open for this trainee. */
export default function CourseChatLink({ courseId }: { courseId: string }) {
  const [s, setS] = useState<{ open: boolean; fastest: boolean; credits: number } | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/arena/courses/${courseId}/chat`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (live && j) setS(j); }).catch(() => undefined);
    return () => { live = false; };
  }, [courseId]);
  if (!s?.open) return null;
  return (
    <Link href={`/trainee/arena/${courseId}/chat`} className="mt-6 flex items-center gap-3 rounded-2xl border border-brand-gray bg-gradient-to-r from-brand-mint to-white px-4 py-3 shadow-sm transition hover:shadow-md" data-testid="course-chat-link">
      <span className="text-2xl" aria-hidden>💬</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-brand-ink">Course chat</span>
        <span className="block text-xs text-gray-600">Talk with your coursemates, challenge them in Ayakbi Arena{s.fastest ? " and race for credits in Fastest Fingers" : ""}.</span>
      </span>
      {s.credits > 0 && <span className="rounded-full bg-[#F2B84B] px-2.5 py-1 text-xs font-extrabold text-[#2A1D00]">⭐ {s.credits}</span>}
      <span aria-hidden className="text-brand-teal">→</span>
    </Link>
  );
}
