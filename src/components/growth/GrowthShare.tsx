"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { uploadPresigned } from "@vercel/blob/client";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { cleanSource } from "@/lib/growth/growthCore";
import { ASSET_RULES, LABEL_MAX, LINK_TOKEN, TEXT_MAX, assetPrefix, embedSnippet, prettySize, renderCaption, type Asset, type AssetKind, type Caption } from "@/lib/growth/shareCore";
import ExpandSelect from "@/components/ui/ExpandSelect";

interface ShareCourse { id: string; title: string; slug: string; link: string; assets: Partial<Record<AssetKind, Asset>> }
interface Data { courses: ShareCourse[]; captions: Caption[]; isDefault: boolean; defaultCount: number }

const btn = "min-h-[44px] rounded-full border border-brand-gray px-4 text-sm font-semibold text-brand-ink hover:bg-brand-mint disabled:opacity-60";
const primary = "min-h-[44px] rounded-full bg-brand-action px-5 text-sm font-bold text-brand-onAccent hover:bg-brand-actionHover disabled:opacity-60";
const field = "mt-1 block min-h-[44px] w-full rounded-lg border border-brand-gray bg-brand-surface px-3 text-base text-brand-ink";

/** Super Admin: everything for sharing a course's funnel link: the animated card, captions you can edit, and your own video and PDF. */
export default function GrowthShare() {
  const { showToast } = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [courseId, setCourseId] = useState("");
  const [src, setSrc] = useState("whatsapp");
  const [editing, setEditing] = useState<{ id: string | null; label: string; text: string } | null>(null);
  const [uploading, setUploading] = useState<AssetKind | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/growth/share", { cache: "no-store" });
    if (!res.ok) { setError("The share kit could not be loaded."); return; }
    const j: Data = await res.json();
    setData(j); setError(null);
    setCourseId((c) => (j.courses.some((x) => x.id === c) ? c : j.courses[0]?.id ?? ""));
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function post(body: Record<string, unknown>, done?: string) {
    setBusy(true); setProblem(null);
    const res = await fetch("/api/admin/growth/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setProblem(json.error ?? "That did not work."); return false; }
    setData(json);
    if (done) showToast(done);
    return true;
  }

  const course = data?.courses.find((c) => c.id === courseId) ?? null;
  const label = cleanSource(src);
  const link = useMemo(() => (course ? `${course.link}${label ? `?src=${label}` : ""}` : ""), [course, label]);
  const origin = useMemo(() => { try { return course ? new URL(course.link).origin : ""; } catch { return ""; } }, [course]);

  function copy(text: string, what: string) {
    void navigator.clipboard?.writeText(text).then(() => showToast(`${what} copied.`)).catch(() => setProblem("Your browser would not copy. Select the text and copy it by hand."));
  }

  async function upload(kind: AssetKind, file: File | undefined) {
    if (!file || !course) return;
    const rules = ASSET_RULES[kind];
    if (!rules.types.includes(file.type)) { setProblem(`That is not a ${rules.label}.`); return; }
    if (file.size > rules.maxBytes) { setProblem(`That file is too big. It must be a ${rules.label}.`); return; }
    setUploading(kind); setProblem(null);
    try {
      const blob = await uploadPresigned(`${assetPrefix(kind)}${file.name}`, file, { access: "public", handleUploadUrl: "/api/admin/growth/share/upload-token", contentType: file.type });
      await post({ action: "setAsset", courseId: course.id, kind, url: blob.url, name: file.name, size: file.size, contentType: file.type }, kind === "video" ? "Your video is saved." : "Your PDF is saved.");
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Could not upload that file. Try again.");
    }
    setUploading(null);
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <SkeletonList rows={3} />;

  return (
    <section aria-labelledby="share-h" data-testid="growth-share">
      <h2 id="share-h" className="font-display text-lg font-semibold text-brand-ink">Share kit</h2>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">The animated play card, captions that make people tap, and your own video and PDF, for any course whose link is live. Every link carries a source label, so the Growth report shows which share brought which players.</p>

      {data.courses.length === 0 || !course ? (
        <Card className="mt-3"><p className="text-sm text-brand-ink" data-testid="share-empty">No course has a live link yet. Switch a course on above and its share kit appears here.</p></Card>
      ) : (
        <div className="mt-3 space-y-3">
          <Card>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm"><span className="font-semibold text-brand-ink">Course</span>
                <ExpandSelect data-testid="share-course" className={field} value={courseId} onChange={(e) => setCourseId(e.target.value)}>{data.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</ExpandSelect>
              </label>
              <label className="block text-sm"><span className="font-semibold text-brand-ink">Source label</span>
                <input data-testid="share-src" className={field} value={src} onChange={(e) => setSrc(e.target.value)} maxLength={60} placeholder="for example lagos-whatsapp-group" />
              </label>
            </div>
            <p className="mt-3 break-all rounded-lg bg-brand-mint p-3 text-sm text-brand-ink" data-testid="share-link">{link}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className={primary} onClick={() => copy(link, "Link")} data-testid="share-copy-link">Copy link</button>
              <button type="button" className={btn} onClick={() => copy(embedSnippet({ link, imageUrl: `${origin}/growth/play-card.gif`, alt: `Play the free ${course.title} challenge`, width: 600 }), "HTML")} data-testid="share-copy-html">Copy HTML for a website or email</button>
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-brand-ink">Captions that make people tap {data.isDefault ? <Badge variant="neutral">Defaults</Badge> : <Badge variant="gold">Customised</Badge>}</h3>
              <div className="flex gap-2">
                <button type="button" className={btn} disabled={busy} data-testid="caption-add" onClick={() => setEditing({ id: null, label: "", text: `\n${LINK_TOKEN}` })}>Add a caption</button>
                {!data.isDefault && <button type="button" className={btn} disabled={busy} data-testid="captions-reset" onClick={() => { if (window.confirm("Replace all your captions with the original defaults?")) void post({ action: "resetCaptions" }, "Back to the defaults."); }}>Back to the defaults</button>}
              </div>
            </div>
            <p className="mt-1 text-sm text-gray-600">Write {LINK_TOKEN} where the funnel link should go (it is filled in with the link above when you copy), and {"{course}"} for the course name.</p>
            <ul className="mt-3 space-y-2" data-testid="caption-list">
              {data.captions.map((c) => (
                <li key={c.id} className="rounded-xl border border-brand-gray/60 bg-brand-surface p-3" data-testid="caption-row">
                  {editing?.id === c.id ? (
                    <CaptionEditor value={editing} busy={busy} onChange={setEditing} onCancel={() => { setEditing(null); setProblem(null); }} onSave={async () => { if (await post({ action: "saveCaption", id: editing.id ?? undefined, label: editing.label, text: editing.text }, "Caption saved.")) setEditing(null); }} />
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-brand-ink">{c.label}</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-brand-ink" data-testid="caption-text">{renderCaption(c.text, { link, course: course.title })}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" className={primary} onClick={() => copy(renderCaption(c.text, { link, course: course.title }), "Caption")} data-testid="caption-copy">Copy</button>
                        <button type="button" className={btn} disabled={busy} onClick={() => { setProblem(null); setEditing({ id: c.id, label: c.label, text: c.text }); }} data-testid="caption-edit">Edit</button>
                        <button type="button" className="min-h-[44px] rounded-full border border-brand-rose px-4 text-sm font-semibold text-brand-rose hover:bg-brand-roseLight disabled:opacity-60" disabled={busy || data.captions.length <= 1} onClick={() => { if (window.confirm(`Delete the caption "${c.label}"?`)) void post({ action: "deleteCaption", id: c.id }, "Caption deleted."); }} data-testid="caption-delete">Delete</button>
                      </div>
                    </>
                  )}
                </li>
              ))}
              {editing?.id === null && (
                <li className="rounded-xl border border-brand-action bg-brand-surface p-3" data-testid="caption-new">
                  <CaptionEditor value={editing} busy={busy} onChange={setEditing} onCancel={() => { setEditing(null); setProblem(null); }} onSave={async () => { if (await post({ action: "saveCaption", label: editing.label, text: editing.text }, "Caption added.")) setEditing(null); }} />
                </li>
              )}
            </ul>
          </Card>

          <Card>
            <h3 className="font-semibold text-brand-ink">The animated card (made for you)</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <a href={link} target="_blank" rel="noopener noreferrer" aria-label="Try the free challenge: opens the funnel link" className="block" data-testid="share-gif-link">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/growth/play-card.gif" alt="The animated play card: Can you beat the clock?" className="w-full rounded-xl border border-brand-gray/60" data-testid="share-gif" />
                <span className="mt-1 block text-xs font-semibold text-brand-teal">Tap the card to try the link</span>
              </a>
              <ul className="space-y-2 text-sm">
                <li className="text-gray-600">Send the <strong className="text-brand-ink">video</strong> on WhatsApp (it plays by itself). Use the <strong className="text-brand-ink">GIF</strong> in emails and web pages. The <strong className="text-brand-ink">PDF</strong> is the still card, and tapping it opens the funnel.</li>
                <li className="flex flex-wrap gap-2">
                  <a className={`${btn} inline-flex items-center`} href="/growth/play-card.mp4" download data-testid="dl-mp4">Video, wide (MP4)</a>
                  <a className={`${btn} inline-flex items-center`} href="/growth/play-card-square.mp4" download>Video, square (MP4)</a>
                  <a className={`${btn} inline-flex items-center`} href="/growth/play-card.gif" download>GIF, wide</a>
                  <a className={`${btn} inline-flex items-center`} href="/growth/play-card-square.gif" download>GIF, square</a>
                  <a className={`${btn} inline-flex items-center`} href="/growth/play-card.png" download>Still image (PNG)</a>
                  <a className={`${primary} inline-flex items-center`} href={`/api/admin/growth/share/${course.id}/pdf?src=${encodeURIComponent(label ?? "pdf")}`} data-testid="dl-pdf">Clickable PDF</a>
                </li>
              </ul>
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold text-brand-ink">Your own video and PDF, for {course.title}</h3>
            <p className="mt-1 text-sm text-gray-600">Upload your own and it is stored here, ready to download or copy a link to. Your PDF is kept exactly as you made it, so put the funnel link inside it yourself (the link above).</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(["video", "pdf"] as AssetKind[]).map((kind) => {
                const a = course.assets[kind];
                return (
                  <div key={kind} className="rounded-xl border border-brand-gray/60 bg-brand-surface p-3" data-testid={`asset-${kind}`}>
                    <p className="text-sm font-semibold text-brand-ink">{kind === "video" ? "Your video" : "Your PDF"}</p>
                    {a ? (
                      <>
                        <p className="mt-1 break-words text-sm text-brand-ink" data-testid={`asset-${kind}-name`}>{a.name} <span className="text-gray-600">· {prettySize(a.size)} · {new Date(a.uploadedAt).toLocaleDateString()}</span></p>
                        {kind === "video" && /* eslint-disable-next-line jsx-a11y/media-has-caption */ <video src={a.url} controls preload="metadata" className="mt-2 w-full rounded-lg bg-black" />}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button type="button" className={primary} onClick={() => copy(a.url, "File link")} data-testid={`asset-${kind}-copy`}>Copy file link</button>
                          <a className={`${btn} inline-flex items-center`} href={a.url} target="_blank" rel="noopener noreferrer">Open</a>
                          <button type="button" className="min-h-[44px] rounded-full border border-brand-rose px-4 text-sm font-semibold text-brand-rose hover:bg-brand-roseLight disabled:opacity-60" disabled={busy || uploading !== null} data-testid={`asset-${kind}-remove`} onClick={() => { if (window.confirm(`Remove your ${kind === "video" ? "video" : "PDF"}? The file is deleted.`)) void post({ action: "removeAsset", courseId: course.id, kind }, "Removed."); }}>Remove</button>
                        </div>
                      </>
                    ) : <p className="mt-1 text-sm text-gray-600">Nothing uploaded yet. A {ASSET_RULES[kind].label}.</p>}
                    <label className={`${btn} mt-2 inline-flex cursor-pointer items-center ${uploading === kind ? "opacity-60" : ""}`}>
                      {uploading === kind ? "Uploading..." : a ? "Replace the file" : `Upload a ${kind === "video" ? "video" : "PDF"}`}
                      <input type="file" className="sr-only" data-testid={`asset-${kind}-input`} accept={ASSET_RULES[kind].types.join(",")} disabled={uploading !== null || busy} onChange={(e) => { void upload(kind, e.target.files?.[0]); e.target.value = ""; }} />
                    </label>
                  </div>
                );
              })}
            </div>
          </Card>
          {problem && <p className="text-sm text-brand-rose" role="alert" data-testid="share-problem">{problem}</p>}
        </div>
      )}
    </section>
  );
}

function CaptionEditor({ value, busy, onChange, onSave, onCancel }: { value: { id: string | null; label: string; text: string }; busy: boolean; onChange: (v: { id: string | null; label: string; text: string }) => void; onSave: () => void; onCancel: () => void }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(); }} data-testid="caption-editor">
      <label className="block text-sm"><span className="font-semibold text-brand-ink">Name</span>
        <input className={field} value={value.label} maxLength={LABEL_MAX} onChange={(e) => onChange({ ...value, label: e.target.value })} data-testid="caption-label" placeholder="A short name only you see" />
      </label>
      <label className="mt-2 block text-sm"><span className="font-semibold text-brand-ink">Caption</span>
        <textarea className={`${field} min-h-[110px] py-2`} value={value.text} maxLength={TEXT_MAX} onChange={(e) => onChange({ ...value, text: e.target.value })} data-testid="caption-textarea" />
      </label>
      <p className="mt-1 text-xs text-gray-600">{value.text.length}/{TEXT_MAX}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={primary} data-testid="caption-save">Save caption</button>
        <button type="button" className={btn} onClick={() => onChange({ ...value, text: `${value.text.replace(/\s+$/, "")} ${LINK_TOKEN}` })} data-testid="caption-insert">Insert {LINK_TOKEN}</button>
        <button type="button" className={btn} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
