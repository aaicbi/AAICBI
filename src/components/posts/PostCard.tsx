import Link from "next/link";
import VideoPlayer from "@/components/video/VideoPlayer";
import Badge from "@/components/ui/Badge";
import AvatarFallback from "@/components/ui/AvatarFallback";
import type { PostView } from "@/lib/posts/posts";
import { STATUS_LABEL } from "@/lib/posts/postCore";

type Who = PostView["author"];

function Name({ who }: { who: Who }) {
  return who.linkable ? <Link href={`/@${who.handle}`} className="font-semibold text-brand-ink hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">{who.name}</Link> : <span className="font-semibold text-brand-ink">{who.name}</span>;
}

function Avatar({ who }: { who: Who }) {
  const inner = (
    <span className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden bg-brand-mint ${who.square ? "rounded-xl" : "rounded-full"}`}>
      {who.avatarUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={who.avatarUrl} alt="" className="no-ring h-full w-full object-cover" /> : <AvatarFallback variant={who.square ? "company" : "person"} size="md" />}
    </span>
  );
  return who.linkable ? <Link href={`/@${who.handle}`} aria-label={`${who.name}'s profile`} tabIndex={-1}>{inner}</Link> : inner;
}

function Gallery({ images }: { images: PostView["images"] }) {
  if (images.length === 0) return null;
  const shown = images.slice(0, 4);
  const more = images.length - shown.length;
  const cols = shown.length === 1 ? "grid-cols-1" : "grid-cols-2";
  return (
    <ul className={`mt-3 grid gap-1.5 overflow-hidden rounded-2xl ${cols}`} aria-label="Images">
      {shown.map((m, i) => (
        <li key={m.url} className={`relative bg-brand-sand ${shown.length === 1 ? "aspect-[4/3]" : shown.length === 3 && i === 0 ? "row-span-2 aspect-[3/4]" : "aspect-square"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.url} alt={m.alt ?? ""} loading="lazy" className="no-ring h-full w-full object-cover" />
          {more > 0 && i === shown.length - 1 && <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-xl font-bold text-white">+{more}</span>}
        </li>
      ))}
    </ul>
  );
}

/** One post, the same card everywhere: who wrote it (and for whom), what they wrote, the pictures or video. */
export default function PostCard({ post, showStatus = false }: { post: PostView; showStatus?: boolean }) {
  const when = post.publishedAt ?? post.createdAt;
  return (
    <article className="rounded-3xl border border-brand-gray bg-brand-surface p-4 shadow-sm sm:p-5" aria-label={`Post by ${post.author.name}`}>
      <header className="flex items-center gap-3">
        <Avatar who={post.author} />
        <div className="min-w-0 flex-1">
          <p className="truncate"><Name who={post.author} /> <Badge variant="neutral">{post.author.kindLabel}</Badge></p>
          <p className="truncate text-xs text-gray-600">
            @{post.author.handle} · {new Date(when).toLocaleDateString("en-GB", { dateStyle: "medium" })}
            {post.actingAs && <> · for <Name who={post.actingAs} /></>}
          </p>
        </div>
        {showStatus && <Badge variant={post.status === "PUBLISHED" ? "success" : post.status === "REJECTED" || post.status === "SUSPENDED" ? "danger" : "warning"}>{STATUS_LABEL[post.status]}</Badge>}
      </header>
      {post.title && <h2 className="mt-3 break-words font-display text-lg font-semibold text-brand-ink">{post.title}</h2>}
      {post.body && <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-brand-ink">{post.body}</p>}
      <Gallery images={post.images} />
      {post.youtubeId && <div className="mt-3"><VideoPlayer source={{ kind: "youtube", id: post.youtubeId }} title={post.title ?? `Video by ${post.author.name}`} /></div>}
      {post.visibility === "MEMBERS" && <p className="mt-3 text-xs font-semibold text-gray-600">Visible to signed-in members only</p>}
    </article>
  );
}
