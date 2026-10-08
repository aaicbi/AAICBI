"use client";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { urlBase64ToUint8Array } from "@/lib/push/client";
import { isStandalone } from "@/lib/pwa/installStore";
import { isIosDevice } from "@/lib/pwa/installCore";

type State = "loading" | "hidden" | "needs-install" | "denied" | "off" | "on";

async function readyRegistration(): Promise<ServiceWorkerRegistration | null> {
  // No service worker in development, so do not wait forever for one.
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 3000))]);
}

/**
 * Turns web push on or off for this device. Shown only where it can work:
 * the platform has push set up, the browser supports it, and (on iPhone and
 * iPad) the app has been added to the home screen first. The device is
 * linked to the signed-in account; turning it off removes it.
 */
export default function PushNotificationsCard() {
  const [state, setState] = useState<State>("loading");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    let live = true;
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      const ios = isIosDevice(navigator.userAgent, navigator.maxTouchPoints);
      if (ios && !isStandalone()) return live && setState("needs-install");
      if (!supported) return live && setState("hidden");
      const info = await fetch("/api/push/subscribe", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (!info?.configured || !info.publicKey) return live && setState("hidden");
      setPublicKey(info.publicKey);
      if (Notification.permission === "denied") return live && setState("denied");
      const reg = await readyRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (live) setState(sub ? "on" : "off");
    })();
    return () => {
      live = false;
    };
  }, []);

  if (state === "loading" || state === "hidden") return null;

  async function enable() {
    if (!publicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await readyRegistration();
      if (!reg) throw new Error("not ready");
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource }));
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "failed");
      setState("on");
      showToast("Notifications are on for this device.", "success");
    } catch (e) {
      showToast(e instanceof Error && e.message !== "failed" && e.message !== "not ready" ? e.message : "Could not turn notifications on. Try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await readyRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
        await sub.unsubscribe();
      }
      setState("off");
      showToast("Notifications are off for this device.", "success");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-4 flex items-start gap-3">
      <Icon icon={Bell} size="md" className="mt-0.5 shrink-0 text-brand-teal" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-brand-ink">Alerts on this device</p>
        {state === "needs-install" && <p className="mt-1 text-sm text-gray-700">To get alerts on an iPhone or iPad, first add the app to your home screen (Share, then <strong>Add to Home Screen</strong>), then open it from there and come back here.</p>}
        {state === "denied" && <p className="mt-1 text-sm text-gray-700">Notifications are blocked for this site. Allow them in your browser or phone settings, then come back here.</p>}
        {state === "off" && <p className="mt-1 text-sm text-gray-700">Get a notification for new messages, events and updates, even when the app is closed.</p>}
        {state === "on" && <p className="mt-1 text-sm text-gray-700">This device gets notifications for messages, events and updates. Messages show only that something arrived, never the text.</p>}
        {state === "off" && <div className="mt-3"><Button size="sm" loading={busy} onClick={enable}>Turn on alerts</Button></div>}
        {state === "on" && <div className="mt-3"><Button size="sm" variant="secondary" loading={busy} onClick={disable}>Turn off alerts</Button></div>}
      </div>
    </Card>
  );
}
