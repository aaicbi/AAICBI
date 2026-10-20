"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ChatSummary } from "@/lib/arena/chat";

interface Alerts { chats: ChatSummary[]; direct: number; challenge: boolean; total: number }

const HOME = new Set(["/", "/feed", "/trainee/dashboard"]);

/**
 * Chat that is going on, wherever a trainee is. Every page: the number on the installed app's icon and in the tab title.
 * Home pages (the feed and the dashboard): a "chat is live" card for each course group chat with unread messages.
 * It asks every 20 seconds while the page is visible and stops for anyone who is not a signed-in trainee.
 */
export default function ChatAlerts() {
  const path = usePathname();
  const [a, setA] = useState<Alerts | null>(null);
  const [later, setLater] = useState<Record<string, number>>({});
  const onChat = path.startsWith("/trainee/arena") && path.endsWith("/chat");

  useEffect(() => {
    let stop = false;
    const load = async () => {
      if (document.hidden || stop) return;
      try {
        const res = await fetch("/api/arena/alerts", { cache: "no-store" });
        if (res.status === 401 || res.status === 403) { stop = true; setA(null); return; }
        if (res.ok && !stop) setA(await res.json());
      } catch { /* offline: try again later */ }
    };
    const first = setTimeout(load, 1500);
    const id = setInterval(() => { void load(); }, 20_000);
    const vis = () => { if (!document.hidden) void load(); };
    const now = () => { void load(); };
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("arena-alerts-refresh", now);
    return () => { stop = true; clearTimeout(first); clearInterval(id); document.removeEventListener("visibilitychange", vis); window.removeEventListener("arena-alerts-refresh", now); };
  }, [path]);

  // The number on the app icon and in the tab title. Reading the chat itself counts as seen.
  const total = a ? Math.max(0, a.total - (onChat ? a.chats.reduce((s, c) => s + (path.includes(`/${c.courseId}/`) ? c.unread : 0), 0) : 0)) : 0;
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    try { if (total > 0) void nav.setAppBadge?.(total); else void nav.clearAppBadge?.(); } catch { /* not supported */ }
    const base = document.title.replace(/^\(\d+\+?\)\s*/, "");
    document.title = total > 0 ? `(${total > 99 ? "99+" : total}) ${base}` : base;
  }, [total, path]);

  if (!a || !HOME.has(path)) return null;
  const live = a.chats.filter((c) => c.unread > 0 && c.unread > (later[c.courseId] ?? 0));
  if (live.length === 0) return null;
  const shown = live.slice(0, 2);
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[70] flex flex-col items-center gap-2 px-4" style={{ top: "calc(env(safe-area-inset-top, 0px) + 4.5rem)" }} data-testid="chat-live">
      {shown.map((c) => (
        <div key={c.courseId} role="status" className="pointer-events-auto w-full max-w-md rounded-2xl border border-white/20 bg-gradient-to-br from-[#0a4a41] to-[#0e5f53] p-3 text-[#f4fbf7] shadow-lg">
          <div className="flex items-center gap-2 text-sm font-extrabold">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#7fd6a0] shadow-[0_0_0_4px_rgba(127,214,160,.25)]" aria-hidden />
            <span className="min-w-0 flex-1 truncate">Chat is live · {c.title}</span>
            <span className="inline-flex h-6 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-[#e5484d] px-2.5 text-xs font-extrabold leading-none text-white">{c.unread > 99 ? "99+" : c.unread} new</span>
          </div>
          {c.preview && <p className="mt-1 truncate text-[13px] text-[#d9ece1]">{c.preview}</p>}
          <div className="mt-2 flex items-center gap-2">
            <Link href={`/trainee/arena/${c.courseId}/chat`} className="rounded-full bg-[#F2B84B] px-3.5 py-1.5 text-xs font-extrabold text-[#2A1D00]">Open chat</Link>
            <button type="button" onClick={() => setLater((l) => ({ ...l, [c.courseId]: c.unread }))} className="rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-extrabold text-[#f4fbf7]">Later</button>
          </div>
        </div>
      ))}
      {live.length > shown.length && <p className="pointer-events-auto rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white">and {live.length - shown.length} more chat{live.length - shown.length === 1 ? "" : "s"} with new messages</p>}
    </div>
  );
}
