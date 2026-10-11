"use client";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";

interface Row { id: string; actorName: string; actorType: string; action: string; createdAt: string }

/** What people in the organization changed lately, newest first, under each person's own name. */
export default function OrgActivityList() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch("/api/org/activity").then((r) => (r.ok ? r.json() : Promise.reject())).then((d) => setRows(d.activity)).catch(() => setFailed(true));
  }, []);
  return (
    <Card className="mt-6">
      <h2 className="font-display text-base font-semibold text-brand-ink">Recent activity</h2>
      <p className="mt-1 text-sm text-gray-600">Changes made by people in your organization, under their own names. It records what was asked for, not whether it succeeded.</p>
      {failed ? <p className="mt-3 text-sm text-gray-700">Activity could not be loaded.</p> : !rows ? <p className="mt-3 text-sm text-gray-700">Loading…</p> : rows.length === 0 ? <p className="mt-3 text-sm text-gray-700">Nothing yet.</p> : (
        <ul className="mt-3 divide-y divide-brand-gray text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2">
              <span className="min-w-0 text-brand-ink"><strong>{r.actorName}</strong>{r.actorType === "OWNER" ? " (owner)" : ""} · {r.action}</span>
              <time className="shrink-0 text-xs text-gray-600" dateTime={r.createdAt}>{new Date(r.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
