"use client";
import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

/**
 * The simple direct inbox's one sending surface — a single shared
 * component rendered from each of the three settings pages (trainee,
 * employer, and admin-for-non-Super-Admin-staff) rather than three
 * copies of the same form. Posts straight to
 * POST /api/messages/to-admin; that route resolves the sender's own
 * identity from their session, so this component only ever collects
 * what the sender actually wants to say.
 */
export default function ContactAdminCard() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const { showToast } = useToast();

  async function send() {
    if (!subject.trim() || !body.trim() || sending) return;
    setSending(true);

    const res = await fetch("/api/messages/to-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: subject.trim(), body: body.trim() }),
    });
    setSending(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Couldn't send that message. Please try again.", "error");
      return;
    }

    showToast("Message sent to the Super Admin.", "success");
    setSubject("");
    setBody("");
  }

  return (
    <Card className="mt-4">
      <p className="font-display font-semibold text-brand-ink">Message the Super Admin</p>
      <p className="mt-1 text-sm text-gray-500">
        Have a question or something to report? Send it directly — it goes straight to the Super Admin's inbox.
      </p>
      <div className="mt-4 space-y-3">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          maxLength={200}
          className="w-full rounded-lg border border-brand-gray px-3 py-2.5 text-sm outline-none focus:border-brand-teal"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Your message…"
          rows={4}
          maxLength={5000}
          className="w-full resize-none rounded-lg border border-brand-gray px-3 py-2.5 text-sm outline-none focus:border-brand-teal"
        />
        <div className="flex justify-end">
          <Button onClick={send} disabled={sending || !subject.trim() || !body.trim()}>
            {sending ? "Sending…" : "Send message"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
