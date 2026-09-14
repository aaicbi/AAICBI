"use client";
import { useEffect, useRef, useState } from "react";
import { MAX_MEDIA_PER_POSTING } from "@/lib/jobPostingMedia";
import { X } from "lucide-react";
import Icon from "@/components/ui/Icon";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/webm"];
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const VIDEO_MAX_BYTES = 20 * 1024 * 1024;

export interface StagedMedia {
  file: File;
  previewUrl: string;
  type: "IMAGE" | "VIDEO";
}

/** Same type/size rules as validateJobPostingMediaFile server-side — checked here too so a bad file is rejected immediately, before ever reaching the upload step. */
function validate(file: File): { type: "IMAGE" | "VIDEO" } | { error: string } {
  if (IMAGE_TYPES.includes(file.type)) {
    if (file.size > IMAGE_MAX_BYTES) return { error: `${file.name}: images must be under 5MB.` };
    return { type: "IMAGE" };
  }
  if (VIDEO_TYPES.includes(file.type)) {
    if (file.size > VIDEO_MAX_BYTES) return { error: `${file.name}: videos must be under 20MB.` };
    return { type: "VIDEO" };
  }
  return { error: `${file.name}: only JPG, PNG, WEBP images or MP4/WEBM videos are allowed.` };
}

/**
 * The "Upload Media" section of the job posting create form. A new
 * posting doesn't have an id yet to attach uploads to, so files are
 * staged locally (with an object-URL preview, exactly what the task's
 * "preview before publish" requirement asks for) and handed to the
 * caller via `onChange` — the create form's submit handler uploads
 * each staged file to /api/job-postings/[id]/media only after the
 * posting itself is successfully created.
 */
export default function JobPostingMediaPicker({
  staged,
  onChange,
}: {
  staged: StagedMedia[];
  onChange: (next: StagedMedia[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Object URLs are only valid for this tab's lifetime — revoke them
  // on unmount so a form left open a long time doesn't leak memory.
  useEffect(() => {
    return () => {
      staged.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    if (staged.length + files.length > MAX_MEDIA_PER_POSTING) {
      setError(`You can add at most ${MAX_MEDIA_PER_POSTING} media items.`);
      return;
    }

    const next: StagedMedia[] = [...staged];
    for (const file of files) {
      const result = validate(file);
      if ("error" in result) {
        setError(result.error);
        continue;
      }
      setError(null);
      next.push({ file, previewUrl: URL.createObjectURL(file), type: result.type });
    }
    onChange(next);
  }

  function remove(index: number) {
    const removed = staged[index];
    URL.revokeObjectURL(removed.previewUrl);
    onChange(staged.filter((_, i) => i !== index));
  }

  return (
    <div>
      <label className="text-xs font-semibold text-gray-600">Upload Media (optional)</label>
      <p className="mt-0.5 text-xs text-gray-500">
        Add photos or a short video to make your posting stand out — up to {MAX_MEDIA_PER_POSTING} items. JPG, PNG, WEBP
        (5MB) or MP4, WEBM (20MB).
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
        multiple
        onChange={handleFilesSelected}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={staged.length >= MAX_MEDIA_PER_POSTING}
        className="mt-2 rounded-lg border border-brand-gray px-3 py-1.5 text-sm font-semibold text-brand-ink disabled:opacity-60"
      >
        + Add Photos or Video
      </button>
      {error && <p className="mt-1.5 text-xs text-brand-rose">{error}</p>}

      {staged.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {staged.map((s, i) => (
            <div key={s.previewUrl} className="group relative aspect-video overflow-hidden rounded-lg bg-brand-mint">
              {s.type === "IMAGE" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.previewUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <video src={s.previewUrl} className="h-full w-full object-cover" controls preload="metadata" />
              )}
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Remove"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
              >
                <Icon icon={X} size="sm" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
