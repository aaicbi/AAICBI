"use client";
import { useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";

/**
 * Course catalogue upgrade — the flyer counterpart to AvatarUpload.tsx,
 * a new component rather than a reuse of that one: AvatarUpload is
 * hardcoded to a circular-avatar shape and a fixed union of profile-
 * picture endpoints, whereas a flyer is a rectangular promotional
 * image with its own courseId-scoped route. Same upload/replace/
 * remove mechanics either way.
 */
export default function CourseFlyerUpload({
  courseId,
  flyerUrl,
  onChange,
}: {
  courseId: string;
  flyerUrl: string | null;
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
    const res = await fetch(`/api/courses/${courseId}/flyer`, { method: "POST", body: formData });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not upload the flyer. Try again.", "error");
      return;
    }
    const data = await res.json();
    onChange(data.flyerUrl);
    showToast("Flyer updated.", "success");
  }

  async function handleRemove() {
    setUploading(true);
    const res = await fetch(`/api/courses/${courseId}/flyer`, { method: "DELETE" });
    setUploading(false);
    if (!res.ok) {
      showToast("Could not remove the flyer. Try again.", "error");
      return;
    }
    onChange(null);
    showToast("Flyer removed.", "success");
  }

  return (
    <div className="flex items-start gap-4">
      <div className="flex h-28 w-44 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-brand-gray bg-brand-mint">
        {flyerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a real, dynamically-uploaded external URL.
          <img src={flyerUrl} alt="Course flyer" className="h-full w-full object-cover" />
        ) : (
          <span className="text-3xl">🖼️</span>
        )}
      </div>
      <div>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileSelected} className="hidden" />
        <div className="flex gap-2">
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="rounded-lg border border-brand-gray px-3 py-1.5 text-sm font-semibold text-brand-ink disabled:opacity-60"
          >
            {uploading ? "Uploading..." : flyerUrl ? "Change" : "Upload flyer"}
          </button>
          {flyerUrl && (
            <button
              onClick={handleRemove}
              disabled={uploading}
              className="rounded-lg border border-brand-gray px-3 py-1.5 text-sm font-semibold text-brand-rose disabled:opacity-60"
            >
              Remove
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500">JPG, PNG, or WEBP. Up to 8MB. Optional.</p>
      </div>
    </div>
  );
}
