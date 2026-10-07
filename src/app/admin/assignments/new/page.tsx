"use client";
import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { Upload, FileText } from "lucide-react";

import { Input, Textarea } from "@/components/ui/Field";
async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.error === "string") return body.error;
    const fieldErrors = body?.error?.fieldErrors;
    if (fieldErrors) {
      const first = Object.values(fieldErrors).flat()[0];
      if (typeof first === "string") return first;
    }
  } catch {
    /* fall through */
  }
  return fallback;
}

/**
 * AI Assignment Engine — the two ways to start a new assignment: upload
 * a Word document (the headline feature) or create one by hand. A
 * query param (`?mode=upload`) just preselects which panel shows first
 * — both stay reachable from either entry point.
 *
 * Build fix (learned the hard way on a previous feature): this page's
 * path has no dynamic segment, so Next.js genuinely tries to
 * statically prerender it — and useSearchParams() in a page that gets
 * prerendered must be wrapped in <Suspense>, or the build fails. See
 * org/billing/payment-callback/page.tsx's own comment for the full
 * story; same fix applied here proactively.
 */
export default function NewAssignmentPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-xl px-6 py-10" />}>
      <NewAssignmentPageContent />
    </Suspense>
  );
}

function NewAssignmentPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<"upload" | "manual">(searchParams.get("mode") === "upload" ? "upload" : "manual");

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <h1 className="font-display text-2xl font-semibold text-brand-ink">New Assignment</h1>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setMode("upload")}
          className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold ${mode === "upload" ? "border-brand-teal bg-brand-mint text-brand-teal" : "border-brand-gray text-gray-600"}`}
        >
          <Icon icon={Upload} size="sm" className="mr-1.5 inline align-text-bottom" /> Upload Word Document
        </button>
        <button
          onClick={() => setMode("manual")}
          className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold ${mode === "manual" ? "border-brand-teal bg-brand-mint text-brand-teal" : "border-brand-gray text-gray-600"}`}
        >
          <Icon icon={FileText} size="sm" className="mr-1.5 inline align-text-bottom" /> Create Manually
        </button>
      </div>

      <Card className="mt-5">
        {mode === "upload" ? <UploadPanel onImported={(id) => router.push(`/admin/assignments/${id}`)} /> : <ManualPanel onCreated={(id) => router.push(`/admin/assignments/${id}`)} />}
      </Card>
    </main>
  );
}

function UploadPanel({ onImported }: { onImported: (id: string) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/admin/assignments/import", { method: "POST", body: formData });
    setUploading(false);
    if (!res.ok) {
      setError(await readApiError(res, "Could not import that document. Try again."));
      return;
    }
    const data = await res.json();
    onImported(data.assignment.id);
  }

  return (
    <div>
      <p className="text-sm text-gray-600">
        Upload a <code>.docx</code> document containing your assignment questions. AI will read it, structure each question
        (type, expected answer, concepts, marks, rubric where provided), and bring you to a review screen before anything
        is published.
      </p>
      <input ref={fileInputRef} type="file" accept=".docx" className="hidden" onChange={handleFileChange} />
      <Button onClick={() => fileInputRef.current?.click()} loading={uploading} className="mt-4 w-full">
        {uploading ? "Reading document..." : "Choose a .docx file"}
      </Button>
      {error && <p className="mt-2 text-sm text-brand-rose">{error}</p>}
    </div>
  );
}

function ManualPanel({ onCreated }: { onCreated: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description: description || null }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(await readApiError(res, "Could not create the assignment. Try again."));
      return;
    }
    const assignment = await res.json();
    onCreated(assignment.id);
  }

  return (
    <form onSubmit={handleCreate} className="space-y-3">
      <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} />
      <Textarea label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      {error && <p className="text-sm text-brand-rose">{error}</p>}
      <Button type="submit" loading={saving} className="w-full">
        Create Assignment
      </Button>
    </form>
  );
}
