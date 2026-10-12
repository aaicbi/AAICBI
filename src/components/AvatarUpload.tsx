"use client";
import { useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import AvatarFallback from "@/components/ui/AvatarFallback";
import ImageFramer from "@/components/ui/ImageFramer";

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
  // Universal profile system, Phase 6 — widened to include the
  // employer logo endpoint. Genuinely the same upload/remove
  // mechanics this component's own doc comment already describes,
  // just another image field on another Prisma model.
  apiPath: "/api/trainee/avatar" | "/api/admin/avatar" | "/api/employer/logo" | `/api/startups/${string}/logo`;
  onChange: (url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  // Choosing a file opens the placing step; the placed picture is what is uploaded.
  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow selecting the same file again later
    if (file) setPending(file);
  }

  async function upload(file: File) {
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
    onChange(data.avatarUrl ?? data.logoUrl);
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
      <ImageFramer file={pending} aspect={1} round title="Place your picture" onCancel={() => setPending(null)} onDone={(f) => { setPending(null); upload(f); }} onUnreadable={(f) => { setPending(null); upload(f); }} />
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-brand-mint">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a
          // real, dynamically-uploaded external URL, not a static
          // local asset next/image's optimizer is meant for.
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <AvatarFallback size="lg" />
          </div>
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
        <p className="mt-1 text-xs text-gray-500">JPG, PNG, or WEBP. Up to 5MB. You can drag and zoom it to place it.</p>
      </div>
    </div>
  );
}
