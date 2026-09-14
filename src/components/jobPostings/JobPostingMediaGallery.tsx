import { X } from "lucide-react";
import Icon from "@/components/ui/Icon";

export interface JobPostingMediaItem {
  id: string;
  type: "IMAGE" | "VIDEO";
  url: string;
}

/**
 * Compact management grid for a posting's media — used wherever an
 * employer or admin is managing (not just viewing) a posting: the
 * create form's live preview, the employer's own posting list, and
 * admin review. Read-only (no `onRemove`) renders the same grid
 * without the remove control, so the trainee-facing hero display
 * doesn't need a second, near-identical component just to drop that
 * one prop.
 */
export default function JobPostingMediaGallery({
  media,
  onRemove,
  removingId,
}: {
  media: JobPostingMediaItem[];
  onRemove?: (id: string) => void;
  removingId?: string | null;
}) {
  if (media.length === 0) return null;

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {media.map((m) => (
        <div key={m.id} className="group relative aspect-video overflow-hidden rounded-lg bg-brand-mint">
          {m.type === "IMAGE" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.url} alt="" className="h-full w-full object-cover" />
          ) : (
            <video src={m.url} className="h-full w-full object-cover" controls preload="metadata" />
          )}
          {onRemove && (
            <button
              onClick={() => onRemove(m.id)}
              disabled={removingId === m.id}
              aria-label="Remove media"
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white opacity-0 transition-opacity hover:bg-black/80 disabled:opacity-60 group-hover:opacity-100"
            >
              <Icon icon={X} size="sm" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
