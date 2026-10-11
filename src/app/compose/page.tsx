"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { LIMITS } from "@/lib/posts/postCore";

interface Identity { key: string; label: string; kind: string; skipsReview: boolean }
interface Img { url: string; alt: string }

function Composer() {
  const params = useSearchParams();
  const router = useRouter();
  const editId = params.get("edit");
  const { showToast } = useToast();
  const [identities, setIdentities] = useState<Identity[] | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [identity, setIdentity] = useState("self");
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [youtube, setYoutube] = useState("");
  const [images, setImages] = useState<Img[]>([]);
  const [visibility, setVisibility] = useState<"PUBLIC" | "MEMBERS">("PUBLIC");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<"draft" | "submit" | "upload" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/posts/identities");
    if (r.status === 401) return setSignedOut(true);
    const d = await r.json();
    setIdentities(d.identities);
    setBlocked(d.blockedReason ?? null);
    if (d.identities[0]) setIdentity(d.identities[0].key);
    if (editId) {
      const p = await fetch(`/api/posts/${editId}`);
      if (p.ok) {
        const { post } = await p.json();
        setBody(post.body); setTitle(post.title ?? ""); setYoutube(post.youtubeUrl ?? ""); setImages(post.images.map((m: { url: string; alt: string | null }) => ({ url: m.url, alt: m.alt ?? "" }))); setVisibility(post.visibility); setStatus(post.status);
      } else setError("That post could not be opened for editing.");
    }
  }, [editId]);
  useEffect(() => { load(); }, [load]);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy("upload"); setError(null);
    for (const f of Array.from(files).slice(0, LIMITS.images - images.length)) {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/posts/media", { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error ?? "Could not upload that image."); break; }
      setImages((list) => [...list, { url: d.url, alt: "" }]);
    }
    setBusy(null);
    if (file.current) file.current.value = "";
  }

  async function save(submit: boolean) {
    setBusy(submit ? "submit" : "draft"); setError(null);
    const payload = { title, body, youtubeUrl: youtube, images: images.map((m) => ({ url: m.url, alt: m.alt })), visibility };
    const res = editId
      ? await fetch(`/api/posts/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch("/api/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, identity, submit }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setBusy(null); return setError(d.error ?? "Could not save."); }
    // Editing keeps the status the server decided; submitting an edited draft is a second step.
    if (editId && submit) {
      const s = await fetch(`/api/posts/${editId}/submit`, { method: "POST" });
      const sd = await s.json().catch(() => ({}));
      if (!s.ok && s.status !== 409) { setBusy(null); return setError(sd.error ?? "Saved, but it could not be sent for review."); }
    }
    setBusy(null);
    showToast(submit ? (identities?.find((i) => i.key === identity)?.skipsReview ? "Published." : "Sent. If it needs a second look you will be told the outcome.") : "Saved as a draft.", "success");
    router.push("/my-posts");
  }

  const current = identities?.find((i) => i.key === identity);
  const publishing = !!current?.skipsReview;
  const backToReview = editId && status === "PUBLISHED" && !publishing;

  return (
    <>
      <SiteHeader nav={[{ label: "Courses", href: "/courses" }, { label: "Feed", href: "/feed" }]} />
      <main className="mx-auto max-w-xl px-4 py-6 sm:px-6">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">{editId ? "Edit post" : "New post"}</h1>
        {signedOut ? (
          <Card className="mt-4"><p className="text-sm text-gray-700">Please sign in to write a post.</p><div className="mt-3 flex flex-wrap gap-2"><Button href="/trainee/login" size="sm">Member sign in</Button><Button href="/trainee/register" size="sm" variant="secondary">Create an account</Button></div></Card>
        ) : !identities ? <div className="mt-4"><SkeletonList rows={2} /></div> : identities.length === 0 ? (
          <Card className="mt-4"><p className="text-sm text-gray-700">{blocked ?? "Your account cannot post yet."}</p></Card>
        ) : (
          <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); save(true); }}>
            <Card className="space-y-4">
              {!editId && identities.length > 1 && <Select label="Post as" value={identity} onChange={(e) => setIdentity(e.target.value)}>{identities.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}</Select>}
              <Input label="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={LIMITS.title} />
              <Textarea label="What do you want to share?" value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={LIMITS.body} hint={`${body.length}/${LIMITS.body}. Add #topics so people can find it.`} />
              <div>
                <p className="text-sm font-semibold text-brand-ink">Images <span className="font-normal text-gray-600">(up to {LIMITS.images})</span></p>
                {images.length > 0 && (
                  <ul className="mt-2 grid grid-cols-2 gap-3">
                    {images.map((m, i) => (
                      <li key={m.url} className="space-y-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.url} alt="" className="no-ring aspect-square w-full rounded-xl object-cover" />
                        <Input label="Describe the image" hideLabel compact value={m.alt} onChange={(e) => setImages((l) => l.map((x, n) => (n === i ? { ...x, alt: e.target.value } : x)))} placeholder="Describe it for people who cannot see it" maxLength={LIMITS.alt} />
                        <button type="button" onClick={() => setImages((l) => l.filter((_, n) => n !== i))} className="min-h-[36px] text-xs font-semibold text-brand-rose hover:underline">Remove</button>
                      </li>
                    ))}
                  </ul>
                )}
                {!youtube && images.length < LIMITS.images && (
                  <>
                    <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" id="post-images" onChange={(e) => upload(e.target.files)} />
                    <label htmlFor="post-images" className="mt-2 inline-flex min-h-[44px] cursor-pointer items-center rounded-full border border-brand-teal px-5 text-sm font-semibold text-brand-teal hover:bg-brand-mint focus-within:ring-2 focus-within:ring-brand-teal">{busy === "upload" ? "Uploading…" : "Add images"}</label>
                  </>
                )}
              </div>
              {images.length === 0 && <Input label="YouTube link (optional)" value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." inputMode="url" hint="A video plays inside the post. A post has a video or images, not both." />}
              <Select label="Who can see it" value={visibility} onChange={(e) => setVisibility(e.target.value as "PUBLIC" | "MEMBERS")}><option value="PUBLIC">Everyone</option><option value="MEMBERS">Signed-in members only</option></Select>
            </Card>
            <p className="text-sm text-gray-700">{publishing ? "As a super admin your own posts are published straight away." : backToReview ? "This post is published. Changing its words, pictures or video sends it back for review, and it is hidden until a reviewer approves the new version." : "Your post is checked automatically when you send it. If it looks fine it is published straight away; if anything needs a second look, the AAICBI team reviews it first. You can follow its status in My posts."}</p>
            {error && <p className="text-sm text-brand-rose" role="alert">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <Link href="/my-posts" className="inline-flex min-h-[44px] items-center px-4 text-sm font-semibold text-gray-700 hover:underline">Cancel</Link>
              {(!editId || status === "DRAFT" || status === "CHANGES_REQUESTED") && <Button type="button" variant="secondary" loading={busy === "draft"} disabled={!!busy} onClick={() => save(false)}>Save draft</Button>}
              <Button type="submit" loading={busy === "submit"} disabled={!!busy}>{status === "PUBLISHED" ? "Save changes" : publishing ? "Publish" : "Submit for review"}</Button>
            </div>
          </form>
        )}
      </main>
    </>
  );
}

export default function ComposePage() {
  return <Suspense fallback={<main className="mx-auto max-w-xl px-4 py-6"><SkeletonList rows={2} /></main>}><Composer /></Suspense>;
}
