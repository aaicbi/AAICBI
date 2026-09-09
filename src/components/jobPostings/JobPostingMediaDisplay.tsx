import type { JobPostingMediaItem } from "./JobPostingMediaGallery";

/**
 * The trainee-facing "make it look like a real job advert" display —
 * the first media item shown large and prominent, any additional
 * items as a smaller strip below. Renders nothing at all when a
 * posting has no media, so the existing plain-text posting cards this
 * page already had keep looking exactly as they did before — media is
 * additive, never required.
 */
export default function JobPostingMediaDisplay({ media }: { media: JobPostingMediaItem[] }) {
  if (media.length === 0) return null;
  const [hero, ...rest] = media;

  return (
    <div className="mt-3">
      <MediaFrame item={hero} className="aspect-video w-full" />
      {rest.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {rest.map((m) => (
            <MediaFrame key={m.id} item={m} className="aspect-video" />
          ))}
        </div>
      )}
    </div>
  );
}

function MediaFrame({ item, className }: { item: JobPostingMediaItem; className: string }) {
  return (
    <div className={`overflow-hidden rounded-xl bg-brand-mint ${className}`}>
      {item.type === "IMAGE" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.url} alt="" className="h-full w-full object-cover" />
      ) : (
        <video src={item.url} className="h-full w-full object-cover" controls preload="metadata" />
      )}
    </div>
  );
}
