"use client";
import { useState } from "react";
import PostCard from "@/components/posts/PostCard";
import CommentsPanel from "@/components/posts/CommentsPanel";
import FollowButton from "@/components/posts/FollowButton";
import { useSocial } from "@/components/posts/SocialProvider";
import { useToast } from "@/components/ui/Toast";
import { REACTIONS, REACTION_LABEL, REPORT_LABEL, REPORT_REASONS, type ReactionKind } from "@/lib/posts/interactionCore";
import type { FeedPost } from "@/lib/posts/interactions";
import ExpandSelect from "@/components/ui/ExpandSelect";

const Icon = ({ d, filled }: { d: string; filled?: boolean }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const PATH = { like: "M7 11v9H3v-9zM7 11l4-8c2 0 3 1 3 3v3h5a2 2 0 012 2l-1 6a3 3 0 01-3 3H7", comment: "M21 12a8 8 0 01-11.5 7.2L3 21l1.8-6.3A8 8 0 1121 12z", save: "M6 3h12v18l-6-4-6 4z", share: "M4 12v7h16v-7M12 3v12M8 7l4-4 4 4", flag: "M5 21V4h12l-2 4 2 4H5" };

const action = "flex min-h-[44px] min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-1 text-sm font-semibold text-gray-700 hover:bg-brand-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal";

/** A post with everything you can do to it: react, comment, save, share, follow its author, report it. */
export default function PostItem({ post, showStatus = false, openComments = false }: { post: FeedPost; showStatus?: boolean; openComments?: boolean }) {
  const { gate, act } = useSocial();
  const { showToast } = useToast();
  const [mine, setMine] = useState<ReactionKind | null>(post.stats.mine);
  const [counts, setCounts] = useState(post.stats.reactions);
  const [saved, setSaved] = useState(post.stats.bookmarked);
  const [comments, setComments] = useState(post.stats.comments);
  const [showComments, setShowComments] = useState(openComments);
  const [picker, setPicker] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<string>("SPAM");
  const [details, setDetails] = useState("");
  const returnTo = `/post/${post.id}`;
  const total = counts.LIKE + counts.INSIGHTFUL + counts.CELEBRATE + counts.DISLIKE;

  async function react(kind: ReactionKind | null) {
    setPicker(false);
    if (!gate(returnTo)) return;
    const before = { mine, counts };
    const next = { ...counts };
    if (mine) next[mine] = Math.max(0, next[mine] - 1);
    if (kind) next[kind] += 1;
    setMine(kind); setCounts(next);
    const res = await act(`/api/posts/${post.id}/react`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind }) }, returnTo);
    if (!res?.ok) { setMine(before.mine); setCounts(before.counts); }
  }
  async function toggleSave() {
    if (!gate(returnTo)) return;
    const was = saved;
    setSaved(!was);
    const res = await act(`/api/posts/${post.id}/bookmark`, { method: was ? "DELETE" : "PUT" }, returnTo);
    if (!res?.ok) setSaved(was);
    else showToast(was ? "Removed from saved." : "Saved. Find it under Saved posts.", "success");
  }
  async function share() {
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: `${post.author.name} on AAICBI`, url });
      else { await navigator.clipboard.writeText(url); showToast("Link copied.", "success"); }
    } catch { /* the person closed the share sheet */ }
  }
  async function sendReport() {
    const res = await act(`/api/posts/${post.id}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason, details }) }, returnTo);
    if (res?.ok) { setReporting(false); setDetails(""); showToast("Thank you. A reviewer will look at this post.", "success"); }
  }

  const subject = post.actingAs ?? post.author;
  return (
    <PostCard
      post={post}
      autoplay
      showStatus={showStatus}
      full={openComments}
      headerAction={post.canFollowAuthor ? <FollowButton profileId={subject.profileId} initial={post.authorFollowed} name={subject.name} /> : null}
      footer={
        <div className="mt-3">
          {(total > 0 || comments > 0) && (
            <p className="flex flex-wrap gap-x-3 text-xs text-gray-600" aria-label="Activity">
              {REACTIONS.filter((k) => counts[k] > 0).map((k) => <span key={k}>{REACTION_LABEL[k]} {counts[k]}</span>)}
              {comments > 0 && <span>{comments} comment{comments === 1 ? "" : "s"}</span>}
            </p>
          )}
          <div className="relative mt-2 flex gap-1 border-t border-brand-gray pt-2">
            <button type="button" className={`${action} ${mine && mine !== "DISLIKE" ? "text-brand-teal" : ""}`} aria-pressed={!!mine && mine !== "DISLIKE"} aria-label={mine && mine !== "DISLIKE" ? `${REACTION_LABEL[mine]}. Tap to undo` : "Like"} onClick={() => react(mine && mine !== "DISLIKE" ? null : "LIKE")}>
              <Icon d={PATH.like} filled={!!mine && mine !== "DISLIKE"} /> <span className="hidden sm:inline">{mine && mine !== "DISLIKE" ? REACTION_LABEL[mine] : "Like"}</span>
            </button>
            <button type="button" className={`${action} ${mine === "DISLIKE" ? "text-brand-rose" : ""}`} aria-pressed={mine === "DISLIKE"} aria-label="Dislike" onClick={() => react(mine === "DISLIKE" ? null : "DISLIKE")}>
              <span className="inline-block rotate-180"><Icon d={PATH.like} filled={mine === "DISLIKE"} /></span> <span className="hidden sm:inline">Dislike</span>
            </button>
            <button type="button" className={`${action} !flex-none px-3`} aria-haspopup="true" aria-expanded={picker} aria-label="More reactions" onClick={() => setPicker((p) => !p)}>
              <span aria-hidden="true">✨</span>
            </button>
            {picker && (
              <div role="group" aria-label="Choose a reaction" className="absolute bottom-full left-0 z-10 mb-2 flex gap-1 rounded-full border border-brand-gray bg-brand-surface p-1 shadow-lg">
                {REACTIONS.filter((k) => k !== "DISLIKE").map((k) => <button key={k} type="button" onClick={() => react(k)} className="min-h-[40px] rounded-full px-3 text-sm font-semibold text-brand-ink hover:bg-brand-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">{REACTION_LABEL[k]}</button>)}
              </div>
            )}
            <button type="button" className={action} aria-expanded={showComments} aria-label="Comment" onClick={() => setShowComments((s) => !s)}><Icon d={PATH.comment} /> <span className="hidden sm:inline">Comment</span></button>
            <button type="button" className={`${action} ${saved ? "text-brand-teal" : ""}`} aria-pressed={saved} aria-label={saved ? "Saved" : "Save"} onClick={toggleSave}><Icon d={PATH.save} filled={saved} /> <span className="hidden sm:inline">{saved ? "Saved" : "Save"}</span></button>
            <button type="button" className={action} aria-label="Share" onClick={share}><Icon d={PATH.share} /> <span className="hidden sm:inline">Share</span></button>
          </div>
          {showComments && <CommentsPanel postId={post.id} onCount={setComments} />}
          <div className="mt-2 text-right">
            {reporting ? (
              <div className="space-y-2 rounded-xl border border-brand-gray p-3 text-left">
                <label className="block text-sm font-semibold text-brand-ink" htmlFor={`reason-${post.id}`}>What is wrong with this post?</label>
                <ExpandSelect id={`reason-${post.id}`} value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-[44px] w-full rounded-lg border border-brand-gray bg-brand-surface px-3 text-sm text-brand-ink">{REPORT_REASONS.map((r) => <option key={r} value={r}>{REPORT_LABEL[r]}</option>)}</ExpandSelect>
                <textarea aria-label="More detail (optional)" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} rows={2} placeholder="More detail (optional)" className="w-full rounded-lg border border-brand-gray bg-brand-surface p-2 text-sm text-brand-ink" />
                <div className="flex justify-end gap-2"><button type="button" onClick={() => setReporting(false)} className="min-h-[40px] px-3 text-sm font-semibold text-gray-700">Cancel</button><button type="button" onClick={sendReport} className="min-h-[40px] rounded-full bg-brand-rose px-4 text-sm font-semibold text-brand-onAccent">Send report</button></div>
              </div>
            ) : <button type="button" onClick={() => { if (gate(returnTo)) setReporting(true); }} className="inline-flex min-h-[36px] items-center gap-1 text-xs font-semibold text-gray-600 hover:text-brand-rose focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"><Icon d={PATH.flag} /> Report</button>}
          </div>
        </div>
      }
    />
  );
}
