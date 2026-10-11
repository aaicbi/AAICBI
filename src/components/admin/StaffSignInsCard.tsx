"use client";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";

interface Row { id: string; at: string; email: string; outcome: string; ip: string | null }
const LABEL: Record<string, string> = { SUCCESS: "Signed in", BAD_CREDENTIALS: "Wrong email or password", INACTIVE: "Deactivated account", RATE_LIMITED: "Blocked: too many attempts" };

/** Recent staff sign-in attempts, for the super admin. Failed attempts show in red so a pattern stands out. */
export default function StaffSignInsCard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch("/api/admin/security/sign-ins").then((r) => (r.ok ? r.json() : Promise.reject())).then((d) => setRows(d.items)).catch(() => setFailed(true));
  }, []);
  return (
    <Card>
      <p className="font-display font-semibold text-brand-ink">Recent staff sign-ins</p>
      <p className="mt-1 text-sm text-gray-600">The last 50 attempts to sign in as staff, including failed ones. Only super admins can see this.</p>
      {failed ? <p className="mt-3 text-sm text-brand-rose">We couldn&apos;t load the sign-in record.</p> : rows === null ? <p className="mt-3 text-sm text-gray-600">Loading…</p> : rows.length === 0 ? <p className="mt-3 text-sm text-gray-600">No attempts recorded yet.</p> : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="text-xs uppercase tracking-wide text-gray-600"><th className="py-1 pr-3 font-semibold">When</th><th className="py-1 pr-3 font-semibold">Email</th><th className="py-1 pr-3 font-semibold">Result</th><th className="py-1 font-semibold">Address</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-brand-gray">
                  <td className="whitespace-nowrap py-1.5 pr-3">{new Date(r.at).toLocaleString()}</td>
                  <td className="py-1.5 pr-3">{r.email}</td>
                  <td className={`py-1.5 pr-3 font-semibold ${r.outcome === "SUCCESS" ? "text-brand-teal" : "text-brand-rose"}`}>{LABEL[r.outcome] ?? r.outcome}</td>
                  <td className="py-1.5 text-gray-600">{r.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
