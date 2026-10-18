"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { channels } from "@/lib/arena/realtimeCore";

/**
 * Keeps a screen current. Ably (when the Super Admin has connected it) only says "something changed", and the page then asks the
 * server for its own view; without Ably the page simply asks every second or two. Either way the server decides what is shown.
 */
export function useArenaLive<T>(url: string, opts: { listen: string[]; pollMs?: number; onData?: (d: T) => void }) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<{ message: string; status: number } | null>(null);
  const [live, setLive] = useState(false);
  const offset = useRef(0);
  const busy = useRef(false);
  const again = useRef(false);
  const onData = useRef(opts.onData);
  onData.current = opts.onData;
  const listenKey = opts.listen.join("|");

  const load = useCallback(async () => {
    if (busy.current) { again.current = true; return; }
    busy.current = true;
    try {
      const res = await fetch(url, { cache: "no-store" });
      // A tab opened before a release keeps its old screens until reloaded. When the server is on a newer release, reload once.
      const server = res.headers.get("x-build"); const mine = process.env.NEXT_PUBLIC_BUILD_ID;
      if (server && mine && server !== mine) {
        let done = false;
        try { done = sessionStorage.getItem(`arena-reload-${server}`) === "1"; sessionStorage.setItem(`arena-reload-${server}`, "1"); } catch { /* private mode: reload anyway once per page load */ }
        if (!done) { location.reload(); return; }
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError({ message: body.error ?? "Something went wrong.", status: res.status }); return; }
      if (typeof body.serverNow === "number") offset.current = body.serverNow - Date.now();
      setError(null); setData(body as T); onData.current?.(body as T);
    } catch { /* offline: keep what is on screen and try again */ }
    finally {
      busy.current = false;
      if (again.current) { again.current = false; void load(); }
    }
  }, [url]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let stop = false;
    let es: EventSource | null = null;
    let renew: ReturnType<typeof setTimeout> | undefined;
    const wanted = new Set(listenKey.split("|").filter(Boolean));
    const connect = async () => {
      try {
        const t = await fetch("/api/arena/realtime/token", { cache: "no-store" }).then((r) => r.json());
        if (stop || t.mode !== "ably") return;
        const names = (t.channels as string[]).filter((c) => wanted.has(c));
        if (!names.length) return;
        es?.close();
        es = new EventSource(`https://realtime.ably.io/event-stream?v=1.2&channels=${names.map(encodeURIComponent).join(",")}&accessToken=${encodeURIComponent(t.token)}`);
        es.onopen = () => setLive(true);
        es.onerror = () => setLive(false);
        es.onmessage = () => void load();
        // The token lasts an hour; swap it a little before it runs out.
        renew = setTimeout(() => void connect(), 50 * 60 * 1000);
      } catch { /* stay on polling */ }
    };
    void connect();
    return () => { stop = true; es?.close(); if (renew) clearTimeout(renew); };
  }, [listenKey, load]);

  useEffect(() => {
    const ms = live ? 8000 : opts.pollMs ?? 1500;
    const id = setInterval(() => { if (!document.hidden) void load(); }, ms);
    const vis = () => { if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", vis); };
  }, [live, load, opts.pollMs]);

  const serverNow = useCallback(() => Date.now() + offset.current, []);
  return { data, setData, error, reload: load, serverNow, live };
}

export { channels };
