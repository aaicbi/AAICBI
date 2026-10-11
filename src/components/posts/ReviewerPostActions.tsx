"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

/** For reviewers on a post's page: take a published post down, or bring a taken-down one back, with a reason. */
export default function ReviewerPostActions({ postId, status }: { postId: string; status: string }) {
  const [asking, setAsking] = useState<"suspend" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();
  if (status !== "PUBLISHED" && status !== "SUSPENDED") return null;

  async function send(action: "suspend" | "reinstate") {
    setBusy(true);
    const r = await fetch(`/api/admin/review/posts/${postId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note }) });
    setBusy(false);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return showToast(d.error ?? "That did not work.", "error");
    showToast(action === "suspend" ? "Post taken down." : "Post published again.", "success");
    setAsking(null); setNote("");
    router.refresh();
  }

  return (
    <div className="mt-4 rounded-2xl border border-brand-gray p-4" aria-label="Reviewer actions">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Reviewer</p>
      {status === "SUSPENDED" ? <Button size="sm" className="mt-2" loading={busy} onClick={() => send("reinstate")}>Publish it again</Button> : asking ? (
        <div className="mt-2 space-y-2">
          <Textarea label="Why is it taken down? (the author will read this)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} />
          <div className="flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => setAsking(null)}>Cancel</Button><Button size="sm" variant="danger" loading={busy} disabled={note.trim().length < 5} onClick={() => send("suspend")}>Take it down</Button></div>
        </div>
      ) : <Button size="sm" variant="secondary" className="mt-2" onClick={() => setAsking("suspend")}>Take this post down</Button>}
    </div>
  );
}
