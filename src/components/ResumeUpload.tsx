"use client";
import { useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";

/**
 * Universal profile system, Phase 6 — the resume/CV counterpart to
 * AvatarUpload.tsx. A document has no circular image preview; this
 * shows a plain "view current file" link plus upload/replace/remove,
 * same upload/remove mechanics as AvatarUpload otherwise.
 */
export default function ResumeUpload({
  resumeUrl,
  onChange,
}: {
  resumeUrl: string | null;
  onChange: (url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    const res = await fetch("/api/trainee/resume", { method: "POST", body: formData });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not upload. Try again.", "error");
      return;
    }
    const data = await res.json();
    onChange(data.resumeUrl);
    showToast("Resume updated.", "success");
  }

  async function handleRemove() {
    setUploading(true);
    const res = await fetch("/api/trainee/resume", { method: "DELETE" });
    setUploading(false);
    if (!res.ok) {
      showToast("Could not remove. Try again.", "error");
      return;
    }
    onChange(null);
    showToast("Resume removed.", "success");
  }

  return (
    <div>
      {resumeUrl && (
        <a href={resumeUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-teal hover:underline">
          View current resume
        </a>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.doc,.docx"
        onChange={handleFileSelected}
        className="hidden"
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-lg border border-brand-gray px-3 py-1.5 text-sm font-semibold text-brand-ink disabled:opacity-60"
        >
          {uploading ? "Uploading..." : resumeUrl ? "Replace" : "Upload"}
        </button>
        {resumeUrl && (
          <button
            onClick={handleRemove}
            disabled={uploading}
            className="rounded-lg border border-brand-gray px-3 py-1.5 text-sm font-semibold text-brand-rose disabled:opacity-60"
          >
            Remove
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-500">PDF, DOC, or DOCX. Up to 10MB.</p>
    </div>
  );
}
