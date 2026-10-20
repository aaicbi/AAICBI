"use client";
import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import AvatarFallback from "@/components/ui/AvatarFallback";
import { useSocial } from "@/components/posts/SocialProvider";
import type { ProfileCard } from "@/lib/profiles/card";

/** Who follows a profile. The number is public; the names are shown to signed-in people only (and only those whose own profile they may see). */
export default function FollowersList({ handle, count }: { handle: string; count: number }) {
  const { gate } = useSocial();
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<ProfileCard[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function load(cursor?: string | null) {
    setBusy(true);
    const r = await fetch(`/api/profiles/followers?handle=${encodeURIComponent(handle)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    setBusy(false);
    if (!r.ok) return;
    const d = await r.json();
    setPeople((p) => (cursor ? [...p, ...d.people] : d.people));
    setNext(d.next);
    setLoaded(true);
  }

  if (count === 0) return null;
  return (
    <div className="mt-3">
      <button type="button" aria-expanded={open} onClick={() => { if (!gate(`/@${handle}`)) return; const o = !open; setOpen(o); if (o && !loaded) load(); }} className="text-sm font-semibold text-brand-teal hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
        {open ? "Hide followers" : "See who follows"}
      </button>
      {open && (
        <div className="mt-2">
          {loaded && people.length === 0 ? <p className="text-sm text-gray-600">None of the followers have a profile you can see.</p> : (
            <ul className="space-y-2">
              {people.map((p) => (
                <li key={p.profileId}>
                  <Link href={`/@${p.handle}`} className="flex items-center gap-3 rounded-xl p-1 hover:bg-brand-mint">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden bg-brand-mint ${p.square ? "rounded-lg" : "rounded-full"}`}>{p.avatarUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img loading="lazy" decoding="async" src={p.avatarUrl} alt="" className="no-ring h-full w-full object-cover" /> : <AvatarFallback variant={p.square ? "company" : "person"} size="sm" />}</span>
                    <span className="min-w-0"><span className="block truncate text-sm font-semibold text-brand-ink">{p.name}</span><span className="block truncate text-xs text-gray-600">@{p.handle} · {p.kindLabel}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {next && <Button size="sm" variant="secondary" className="mt-2" loading={busy} onClick={() => load(next)}>Show more</Button>}
        </div>
      )}
    </div>
  );
}
