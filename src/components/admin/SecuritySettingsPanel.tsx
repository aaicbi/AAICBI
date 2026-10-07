"use client";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import { useToast } from "@/components/ui/Toast";

import { Input } from "@/components/ui/Field";
interface SecurityData {
  qaWarningsBeforeSuspension: number;
  staffSessionHours: number;
  traineeSessionDays: number;
  employerSessionHours: number;
}

/**
 * Settings-page redesign, Security category. Two real, previously
 * hardcoded-and-unreachable controls: the Q&A moderation escalation
 * threshold (src/lib/qaModeration.ts) and the per-role-family session
 * length (src/lib/auth/session.ts's `createSession`) — see that file's
 * own comment for why these three numbers were a static constant for
 * years despite its own note that they were "a judgment call... revisit
 * if real usage says otherwise."
 *
 * Session-length changes only affect sessions created AFTER the save —
 * anyone already logged in keeps whatever expiry their existing token
 * was issued with; there's no mechanism to retroactively shorten or
 * extend a token already signed, matching how JWTs actually work.
 */
export default function SecuritySettingsPanel({ viewerRole }: { viewerRole?: string }) {
  const [data, setData] = useState<SecurityData | null>(null);
  const [initial, setInitial] = useState<SecurityData | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { showToast } = useToast();

  function load() {
    setLoadError(false);
    setForbidden(false);
    setData(null);
    fetch("/api/admin/platform-settings")
      .then((r) => {
        if (r.status === 403) {
          setForbidden(true);
          return null;
        }
        return r.ok ? r.json() : Promise.reject();
      })
      .then((json: SecurityData | null) => {
        if (!json) return;
        const value: SecurityData = {
          qaWarningsBeforeSuspension: json.qaWarningsBeforeSuspension,
          staffSessionHours: json.staffSessionHours,
          traineeSessionDays: json.traineeSessionDays,
          employerSessionHours: json.employerSessionHours,
        };
        setData(value);
        setInitial(value);
      })
      .catch(() => setLoadError(true));
  }

  useEffect(() => {
    if (viewerRole && viewerRole !== "SUPER_ADMIN") {
      setForbidden(true);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerRole]);

  const dirty =
    data !== null &&
    initial !== null &&
    (data.qaWarningsBeforeSuspension !== initial.qaWarningsBeforeSuspension ||
      data.staffSessionHours !== initial.staffSessionHours ||
      data.traineeSessionDays !== initial.traineeSessionDays ||
      data.employerSessionHours !== initial.employerSessionHours);

  useEffect(() => {
    if (!dirty) return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  async function save() {
    if (!data) return;
    setSaving(true);
    setSaveError(null);
    const res = await fetch("/api/admin/platform-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (!res.ok) {
      const message =
        res.status === 403 ? "Only Super Admins can change security settings." : "We couldn't save these settings. Please try again.";
      setSaveError(message);
      showToast(message, "error");
      return;
    }
    const updated = await res.json();
    const value: SecurityData = {
      qaWarningsBeforeSuspension: updated.qaWarningsBeforeSuspension,
      staffSessionHours: updated.staffSessionHours,
      traineeSessionDays: updated.traineeSessionDays,
      employerSessionHours: updated.employerSessionHours,
    };
    setData(value);
    setInitial(value);
    showToast("Settings saved successfully.", "success");
  }

  function cancel() {
    if (initial) setData(initial);
    setSaveError(null);
  }

  if (forbidden) {
    return (
      <Card>
        <p className="font-display font-semibold text-brand-ink">Security</p>
        <p className="mt-2 text-sm text-gray-600">
          Only Super Admins can view or change security settings. If you need something changed here, ask a Super
          Admin on your team.
        </p>
      </Card>
    );
  }

  if (loadError) {
    return <ErrorState message="We couldn't load security settings." onRetry={load} />;
  }

  if (data === null) {
    return <SkeletonList rows={2} />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <p className="font-display font-semibold text-brand-ink">Session Length</p>
        <p className="mt-1 text-sm text-gray-600">
          How long someone stays signed in before needing to log in again. Only affects sessions created after you
          save — anyone already signed in keeps their current session until it naturally expires.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Input label="Staff (hours)" compact controlClassName="font-normal" type="number" min={1} max={168} value={data.staffSessionHours} onChange={(e) => setData({ ...data, staffSessionHours: Number(e.target.value) })} />
          <Input label="Trainee (days)" compact controlClassName="font-normal" type="number" min={1} max={90} value={data.traineeSessionDays} onChange={(e) => setData({ ...data, traineeSessionDays: Number(e.target.value) })} />
          <Input label="Employer (hours)" compact controlClassName="font-normal" type="number" min={1} max={168} value={data.employerSessionHours} onChange={(e) => setData({ ...data, employerSessionHours: Number(e.target.value) })} />
        </div>
      </Card>

      <Card>
        <p className="font-display font-semibold text-brand-ink">Q&amp;A Warnings Before Suspension</p>
        <p className="mt-1 text-sm text-gray-600">
          How many open Q&amp;A moderation warnings a trainee can accumulate before this app automatically suspends
          their posting access. Doesn&apos;t affect a warning that&apos;s already been issued or reversed.
        </p>
        <Input label="Warnings before suspension" compact wrapperClassName="w-40" type="number" min={1} max={100} value={data.qaWarningsBeforeSuspension} onChange={(e) => setData({ ...data, qaWarningsBeforeSuspension: Number(e.target.value) })} />
      </Card>

      {saveError && <p className="text-sm text-brand-rose">{saveError}</p>}

      <div className="flex items-center gap-3">
        <Button onClick={save} loading={saving} disabled={!dirty}>
          Save Changes
        </Button>
        {dirty && (
          <>
            <Button variant="ghost" onClick={cancel} disabled={saving}>
              Cancel
            </Button>
            <span className="text-xs font-semibold text-brand-goldText">Unsaved changes</span>
          </>
        )}
      </div>
    </div>
  );
}
