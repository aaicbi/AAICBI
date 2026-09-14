"use client";
import { useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import Icon from "@/components/ui/Icon";
import { FileText } from "lucide-react";

/**
 * Course catalogue upgrade — the curriculum-document counterpart to
 * CourseFlyerUpload.tsx, right beside it: same mechanics, a file-row
 * preview (icon + link + upload timestamp) instead of an image
 * preview, since a PDF/DOC/DOCX has no useful inline thumbnail here.
 */
export default function CourseCurriculumUpload({
  courseId,
  curriculumUrl,
  curriculumUploadedAt,
  onChange,
}: {
  courseId: string;
  curriculumUrl: string | null;
  curriculumUploadedAt: string | null;
  onChange: (url: string | null, uploadedAt: string | null) => void;
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
    const res = await fetch(`/api/courses/${courseId}/curriculum`, { method: "POST", body: formData });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not upload the curriculum. Try again.", "error");
      return;
    }
    const data = await res.json();
    onChange(data.curriculumUrl, data.curriculumUploadedAt);
    showToast("Curriculum updated.", "success");
  }

  async function handleRemove() {
    setUploading(true);
    const res = await fetch(`/api/courses/${courseId}/curriculum`, { method: "DELETE" });
    setUploading(false);
    if (!res.ok) {
      showToast("Could not remove the curriculum. Try again.", "error");
      return;
    }
    onChange(null, null);
    showToast("Curriculum removed.", "success");
  }

  return (
    <div>
      {curriculumUrl && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-brand-gray bg-gray-50 px-3 py-2 text-sm">
          <Icon icon={FileText} size="sm" />
          <a href={curriculumUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand-teal hover:underline">
            View current curriculum
          </a>
          {curriculumUploadedAt && (
            <span className="text-xs text-gray-500">Uploaded {new Date(curriculumUploadedAt).toLocaleDateString()}</span>
          )}
        </div>
      )}
      <input ref={inputRef} type="file" accept=".pdf,.doc,.docx" onChange={handleFileSelected} className="hidden" />
      <div className="flex gap-2">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-lg border border-brand-gray px-3 py-1.5 text-sm font-semibold text-brand-ink disabled:opacity-60"
        >
          {uploading ? "Uploading..." : curriculumUrl ? "Replace" : "Upload curriculum"}
        </button>
        {curriculumUrl && (
          <button
            onClick={handleRemove}
            disabled={uploading}
            className="rounded-lg border border-brand-gray px-3 py-1.5 text-sm font-semibold text-brand-rose disabled:opacity-60"
          >
            Remove
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-500">PDF, DOC, or DOCX. Up to 10MB. Optional.</p>
    </div>
  );
}
