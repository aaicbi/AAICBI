"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarCheck, ExternalLink, KeyRound, Video } from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Select } from "@/components/ui/Field";
import { formatInstant, formatWhen } from "@/lib/events/eventsCore";
import type { EventDetail, JoinDetails } from "@/lib/events/events";

/**
 * Registration and the way into an online session. The joining details are fetched only when someone presses the button and only when the
 * server says they may have them; the page itself never contains the link. Opening it is never counted as attendance.
 */
export default function EventParticipation({ detail, loginHref }: { detail: EventDetail; loginHref: string }) {
  const router = useRouter();
  const e = detail.event;
  const [me, setMe] = useState(detail.me);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [join, setJoin] = useState<JoinDetails | null>(null);
  const [mode, setMode] = useState<"ONLINE" | "PHYSICAL">(e.delivery === "PHYSICAL" ? "PHYSICAL" : "ONLINE");
  const online = e.delivery !== "PHYSICAL";
  const open = e.status === "SCHEDULED" && e.phase !== "COMPLETED";
  const needsRegistration = e.registrationMode !== "OPEN";

  async function register() {
    setBusy(true); setProblem(null);
    const r = await fetch(`/api/events/${e.id}/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attendanceMode: e.delivery === "HYBRID" && e.hybridSeparateRegistration ? mode : undefined }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setProblem(j.error ?? "That did not work."); return; }
    setMe({ ...me, registration: j.status, canRegister: false, registerReason: "You are already registered." });
    router.refresh();
  }
  async function unregister() {
    setBusy(true); setProblem(null);
    const r = await fetch(`/api/events/${e.id}/register`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setProblem(j.error ?? "That did not work."); return; }
    setMe({ ...me, registration: "CANCELLED", canRegister: true, registerReason: null }); setJoin(null);
    router.refresh();
  }
  async function getJoin() {
    setBusy(true); setProblem(null);
    const r = await fetch(`/api/events/${e.id}/join`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setProblem(j.error ?? "Could not get the joining details."); return; }
    setJoin(j);
  }

  return (
    <section aria-label="Take part" className="space-y-4 rounded-2xl border border-brand-gray bg-brand-surface p-4" data-testid="event-participation">
      {open && needsRegistration && !e.registrationUrl && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-semibold text-brand-ink">Registration</h2>
            {me.registration === "CONFIRMED" && <Badge variant="success">You are registered</Badge>}
            {me.registration === "PENDING" && <Badge variant="warning">Waiting for approval</Badge>}
            {me.registration === "DECLINED" && <Badge variant="danger">Not accepted</Badge>}
          </div>
          {e.capacity !== null && e.confirmedCount !== null && <p className="text-sm text-gray-700">{Math.max(e.capacity - e.confirmedCount, 0)} of {e.capacity} places left</p>}
          {e.registrationDeadline && <p className="text-sm text-gray-700">Register by {formatInstant(new Date(e.registrationDeadline), e.timeZone)}</p>}
          {e.registrationNotes && <p className="whitespace-pre-line text-sm text-gray-700">{e.registrationNotes}</p>}
          {!me.signedIn && <Link href={loginHref} className="inline-flex min-h-[44px] items-center rounded-full bg-brand-action px-5 text-sm font-semibold text-brand-onAccent hover:bg-brand-actionHover">Sign in to register</Link>}
          {me.signedIn && me.canRegister && (
            <div className="flex flex-wrap items-end gap-3">
              {e.delivery === "HYBRID" && e.hybridSeparateRegistration && <Select label="How will you attend?" value={mode} onChange={(ev) => setMode(ev.target.value as "ONLINE" | "PHYSICAL")} compact><option value="ONLINE">Online</option><option value="PHYSICAL">In person</option></Select>}
              <Button type="button" loading={busy} onClick={() => void register()} iconLeft={<CalendarCheck className="h-4 w-4" aria-hidden="true" />}>{e.registrationMode === "APPROVAL" ? "Ask to attend" : "Register"}</Button>
            </div>
          )}
          {me.signedIn && !me.canRegister && me.registration !== "CONFIRMED" && me.registration !== "PENDING" && me.registerReason && <p className="text-sm text-gray-700">{me.registerReason}</p>}
          {me.signedIn && (me.registration === "CONFIRMED" || me.registration === "PENDING") && <Button type="button" variant="secondary" loading={busy} onClick={() => void unregister()}>Cancel my registration</Button>}
        </div>
      )}
      {open && e.registrationUrl && (
        <div><h2 className="font-display text-lg font-semibold text-brand-ink">Register</h2><p className="text-sm text-gray-700">The organiser takes registrations on its own page.</p>
          <a href={e.registrationUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-brand-action px-5 text-sm font-semibold text-brand-onAccent hover:bg-brand-actionHover">Open the registration page <ExternalLink className="h-4 w-4" aria-hidden="true" /></a></div>
      )}
      {open && !needsRegistration && !online && <p className="text-sm text-gray-700">No registration needed. Just come along.</p>}

      {open && online && (
        <div className="space-y-2" data-testid="join-box">
          <h2 className="font-display text-lg font-semibold text-brand-ink">Online session</h2>
          <p className="text-sm text-gray-700">{e.conferenceProvider ?? "Video call"} · {formatWhen(new Date(e.startsAt), new Date(e.endsAt), e.timeZone)}</p>
          <p className="text-xs text-gray-600">The call runs on {e.conferenceProvider ?? "an outside video service"}. AAICBI does not host or record it.</p>
          {!join && (
            <>
              <Button type="button" disabled={!me.join.available} loading={busy} onClick={() => void getJoin()} iconLeft={<Video className="h-4 w-4" aria-hidden="true" />}>Join live session</Button>
              {!me.join.available && (
                <p className="text-sm text-gray-700">
                  {me.join.reason ?? "Not available yet."}
                  {me.join.opensAt && <> It opens at {formatInstant(new Date(me.join.opensAt), e.timeZone)}.</>}
                  {!me.signedIn && <> <Link href={loginHref} className="font-semibold text-brand-teal underline">Sign in</Link></>}
                </p>
              )}
            </>
          )}
          {join && (
            <div className="space-y-2 rounded-xl border border-brand-teal bg-brand-mint/40 p-3" data-testid="join-details">
              <a href={join.meetingUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-brand-action px-5 text-sm font-semibold text-brand-onAccent hover:bg-brand-actionHover" data-testid="join-link"><Video className="h-4 w-4" aria-hidden="true" /> Open {join.provider ?? "the meeting"} <ExternalLink className="h-4 w-4" aria-hidden="true" /></a>
              {join.meetingId && <p className="text-sm text-brand-ink">Meeting ID: <b className="font-mono">{join.meetingId}</b></p>}
              {join.passcode && <p className="flex items-center gap-2 text-sm text-brand-ink"><KeyRound className="h-4 w-4" aria-hidden="true" /> Passcode: <b className="font-mono">{join.passcode}</b></p>}
              {join.instructions && <p className="whitespace-pre-line text-sm text-gray-800">{join.instructions}</p>}
              <p className="text-xs text-gray-600">Do not share this link. Opening it is not recorded as attendance.</p>
            </div>
          )}
        </div>
      )}
      {problem && <p role="alert" className="text-sm text-brand-rose">{problem}</p>}
      {!open && <p className="text-sm text-gray-700">{e.status === "CANCELLED" ? "This event was cancelled." : "This event has finished."}</p>}
    </section>
  );
}
