"use client";
import { useState } from "react";
import Link from "next/link";
import { Bookmark, Heart } from "lucide-react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";

/** Like and save for a published video. Only signed-in trainees can react; everyone else is pointed to sign in. */
export function ReactionButtons({
  postId, initialLiked, initialSaved, initialLikeCount, signedIn, nextPath,
}: { postId: string; initialLiked: boolean; initialSaved: boolean; initialLikeCount: number; signedIn: boolean; nextPath: string }) {
  const [liked, setLiked] = useState(initialLiked);
  const [saved, setSaved] = useState(initialSaved);
  const [likes, setLikes] = useState(initialLikeCount);
  const [busy, setBusy] = useState(false);

  async function toggle(kind: "like" | "save") {
    if (busy) return;
    const active = kind === "like" ? liked : saved;
    setBusy(true);
    const res = await fetch(`/api/trainee/education-posts/${postId}/reactions/${kind}`, { method: active ? "DELETE" : "POST" });
    setBusy(false);
    if (!res.ok) return;
    if (kind === "like") {
      setLiked(!active);
      setLikes((n) => n + (active ? -1 : 1));
    } else setSaved(!active);
  }

  if (!signedIn) {
    return (
      <p className="text-sm text-gray-600">
        <Link href={`/trainee/login?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-brand-teal hover:underline">Sign in as a trainee</Link> to like or save this video.
        {likes > 0 && ` ${likes} ${likes === 1 ? "like" : "likes"}.`}
      </p>
    );
  }
  return (
    <div className="flex gap-2">
      <Button type="button" size="sm" variant={liked ? "primary" : "secondary"} aria-pressed={liked} onClick={() => toggle("like")} iconLeft={<Icon icon={Heart} size="sm" />}>
        {liked ? "Liked" : "Like"} · {likes}
      </Button>
      <Button type="button" size="sm" variant={saved ? "primary" : "secondary"} aria-pressed={saved} onClick={() => toggle("save")} iconLeft={<Icon icon={Bookmark} size="sm" />}>
        {saved ? "Saved" : "Save"}
      </Button>
    </div>
  );
}

/** Follow an organization. Same sign-in rule as reactions. */
export function FollowButton({ orgId, initialFollowing, signedIn, nextPath }: { orgId: string; initialFollowing: boolean; signedIn: boolean; nextPath: string }) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  if (!signedIn) {
    return <Button href={`/trainee/login?next=${encodeURIComponent(nextPath)}`} size="sm" variant="secondary">Follow</Button>;
  }
  async function toggle() {
    setBusy(true);
    const res = await fetch(`/api/trainee/org-follows/${orgId}`, { method: following ? "DELETE" : "POST" });
    setBusy(false);
    if (res.ok) setFollowing(!following);
  }
  return (
    <Button type="button" size="sm" variant={following ? "secondary" : "primary"} loading={busy} aria-pressed={following} onClick={toggle}>
      {following ? "Following" : "Follow"}
    </Button>
  );
}
