"use client";
import { useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";

/**
 * M44 — one shared component for both trainee and staff settings,
 * parameterized by which API route to call rather than duplicated —
 * the upload/remove mechanics are genuinely identical for both, only
 * the endpoint differs.
 */
export default function AvatarUpload({
  avatarUrl,
  apiPath,
  onChange,
}: {
  avatarUrl: string | null;
  apiPath: "/api/trainee/avatar" | "/api/admin/avatar";
  onChange: (url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow selecting the same file again later
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    const res = await fetch(apiPath, { method: "POST", body: formData });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not upload. Try again.", "error");
      return;
    }
    const data = await res.json();
    onChange(data.avatarUrl);
    showToast("Profile picture updated.", "success");
  }

  async function handleRemove() {
    setUploading(true);
    const res = await fetch(apiPath, { method: "DELETE" });
    setUploading(false);
    if (!res.ok) {
      showToast("Could not remove. Try again.", "error");
      return;
    }
    onChange(null);
    showToast("Profile picture removed.", "success");
  }

  return (
    <div className="flex items-center gap-4">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-brand-mint">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a
          // real, dynamically-uploaded external URL, not a static
          // local asset next/image's optimizer is meant for.
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl text-brand-teal">🙂</div>
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
            {uploading ? "Uploading..." : avatarUrl ? "Change" : "Upload"}
          </button>
          {avatarUrl && (
            <button
              onClick={handleRemove}
              disabled={uploading}
              className="rounded-lg border border-brand-gray px-3 py-1.5 text-sm font-semibold text-brand-rose disabled:opacity-60"
            >
              Remove
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500">JPG, PNG, or WEBP. Up to 5MB.</p>
      </div>
    </div>
  );
}
