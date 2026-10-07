"use client";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

interface Program { id: string; title: string; category: string | null; status: string; skills: string[] }

export default function OrgProgramSkills() {
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [text, setText] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { showToast } = useToast();

  function load() {
    setLoadError(false);
    fetch("/api/org/programs")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((rows: Program[]) => {
        setPrograms(rows);
        setText(Object.fromEntries(rows.map((p) => [p.id, p.skills.join(", ")])));
      })
      .catch(() => setLoadError(true));
  }
  useEffect(load, []);

  async function save(id: string) {
    setBusyId(id);
    const skills = (text[id] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const res = await fetch(`/api/org/programs/${id}/skills`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ skills }) });
    setBusyId(null);
    if (!res.ok) return showToast((await res.json().catch(() => ({}))).error ?? "Could not save.", "error");
    const body = await res.json();
    setText((t) => ({ ...t, [id]: body.skills.join(", ") }));
    showToast("Skills saved.", "success");
  }

  if (loadError) return <ErrorState message="Could not load your programs." onRetry={load} />;
  if (!programs) return <SkeletonList rows={3} />;
  if (programs.length === 0) return <EmptyState title="No programs yet" description="Create a course first, then tag it with skills here." />;

  return (
    <div className="space-y-4">
      {programs.map((p) => (
        <Card key={p.id} className="space-y-3">
          <div>
            <p className="font-semibold text-brand-ink">{p.title}</p>
            <p className="text-xs text-gray-600">{[p.category, p.status === "PUBLISHED" ? "Published" : "Not published"].filter(Boolean).join(" • ")}</p>
          </div>
          <Input label="Skills taught" value={text[p.id] ?? ""} onChange={(e) => setText({ ...text, [p.id]: e.target.value })} hint="Comma separated, for example SQL, Power BI, Excel" />
          <Button size="sm" loading={busyId === p.id} onClick={() => save(p.id)}>Save skills</Button>
        </Card>
      ))}
    </div>
  );
}
