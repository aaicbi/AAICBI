"use client";
import { useEffect, useState } from "react";
import { urlBase64ToUint8Array } from "@/lib/push/client";
import { isStandalone } from "@/lib/pwa/installStore";
import { isIosDevice } from "@/lib/pwa/installCore";

type State = "hidden" | "off" | "needs-install" | "denied";

/**
 * "Get challenge alerts on your phone". Shown to a trainee who has not turned phone notifications on, so a challenge can reach them
 * on their home screen even when they are not in the app. Hidden once alerts are on, or where the device cannot do them.
 */
export default function PushNudge({ what = "challenges and chat messages" }: { what?: string }) {
  const [state, setState] = useState<State>("hidden");
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try { if (sessionStorage.getItem("aaicbi-push-nudge") === "no") return; } catch { /* storage unavailable */ }
      const ios = isIosDevice(navigator.userAgent, navigator.maxTouchPoints);
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      const info = await fetch("/api/push/subscribe", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (!info?.configured || !info.publicKey) return;
      if (ios && !isStandalone()) return live && setState("needs-install");
      if (!supported) return;
      if (Notification.permission === "denied") return live && setState("denied");
      const reg = await Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 3000))]);
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (live && !sub) { setKey(info.publicKey); setState("off"); }
    })();
    return () => { live = false; };
  }, []);

  if (state === "hidden" || gone) return null;

  async function enable() {
    if (!key) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) as BufferSource }));
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (res.ok) setGone(true);
    } catch { /* leave the nudge up so they can try again */ } finally { setBusy(false); }
  }
  function later() { try { sessionStorage.setItem("aaicbi-push-nudge", "no"); } catch { /* ignore */ } setGone(true); }

  return (
    <div className="ar-note ar-info" role="status" data-testid="push-nudge" style={{ display: "flex", alignItems: "center", gap: ".6em", flexWrap: "wrap" }}>
      <span style={{ flex: "1 1 14em" }}>
        {state === "off" && <>🔔 Get {what} on your phone's home screen, even when the app is closed.</>}
        {state === "needs-install" && <>🔔 To get {what} on an iPhone, first add the app to your home screen (Share, then Add to Home Screen).</>}
        {state === "denied" && <>🔔 Notifications are blocked for this site. Allow them in your phone settings to get {what} on your home screen.</>}
      </span>
      {state === "off" && <button type="button" className="ar-btn ar-sm" disabled={busy} onClick={() => void enable()}>Turn on</button>}
      <button type="button" className="ar-btn ar-ghost ar-sm" onClick={later}>Not now</button>
    </div>
  );
}
