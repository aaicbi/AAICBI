"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Toggle from "@/components/ui/Toggle";
import { useToast } from "@/components/ui/Toast";

/** The Command Center's own switch for Loop, the guide on every page, with a way into its answers. */
export default function GuideSwitchCard() {
  const [state, setState] = useState<{ enabled: boolean; waiting: number } | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    fetch("/api/admin/guide")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setState({ enabled: d.enabled, waiting: d.unanswered.length }))
      .catch(() => {});
  }, []);

  if (!state) return null;

  async function toggle(enabled: boolean) {
    const res = await fetch("/api/admin/guide", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) });
    if (!res.ok) {
      showToast("Could not change Loop's switch.", "error");
      return;
    }
    setState((s) => (s ? { ...s, enabled } : s));
  }

  return (
    <Card className="mt-6 flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-display text-base font-semibold text-brand-ink">Loop guide on every page</p>
        <p className="mt-1 text-sm text-gray-600">
          The helper visitors see everywhere, answering from written answers.{" "}
          <Link href="/admin/command/guide" className="font-semibold text-brand-teal underline underline-offset-2">
            Manage answers{state.waiting > 0 ? ` (${state.waiting} question${state.waiting === 1 ? "" : "s"} waiting)` : ""}
          </Link>
        </p>
      </div>
      <Toggle checked={state.enabled} label="Loop guide on every page" onChange={toggle} />
    </Card>
  );
}
