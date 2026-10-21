"use client";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

/** Download and email buttons for a report: one trainee (traineeId) or the whole roster (query narrows it). The server decides who may see what. */
export default function ReportActions({ traineeId, q = "", courseId = "" }: { traineeId?: string; q?: string; courseId?: string }) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const qs = new URLSearchParams({ ...(q ? { q } : {}), ...(courseId ? { courseId } : {}) }).toString();
  const sfx = qs ? `?${qs}` : "";

  async function send() {
    setBusy(true); setProblem(null);
    const res = await fetch("/api/reports/trainees/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ traineeId, q: q || undefined, courseId: courseId || undefined, to, message: message || undefined }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setProblem(j.error ?? "That did not work."); return; }
    setOpen(false); setTo(""); setMessage("");
    showToast(j.failed?.length ? `Sent, but ${j.failed.length} address(es) failed.` : "Report sent.");
  }

  return (
    <div className="flex flex-wrap gap-2" data-testid="report-actions">
      {traineeId ? (
        <Button href={`/api/reports/trainees/${traineeId}/report.pdf`} variant="secondary" size="sm">Download PDF</Button>
      ) : (
        <>
          <Button href={`/api/reports/trainees/export.pdf${sfx}`} variant="secondary" size="sm">Export PDF</Button>
          <Button href={`/api/reports/trainees/export.csv${sfx}`} variant="secondary" size="sm">Export CSV</Button>
        </>
      )}
      <Button type="button" size="sm" onClick={() => { setOpen(true); setProblem(null); }}>Email report</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Email this report as a PDF">
        <div className="space-y-3">
          <Input label="Send to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@example.com, other@example.com" hint="Up to 5 addresses, separated by commas." />
          <Textarea label="Message (optional)" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={2000} hint="Shown above the report in the email and on the first page of the PDF." />
          {problem && <p role="alert" className="text-sm text-brand-rose">{problem}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="button" loading={busy} onClick={() => void send()} disabled={!to.trim()}>Send report</Button></div>
        </div>
      </Modal>
    </div>
  );
}
