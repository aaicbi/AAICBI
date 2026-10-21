"use client";
import { useCallback, useEffect, useState } from "react";
import { uploadPresigned } from "@vercel/blob/client";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import SponsoredCard from "@/components/ads/SponsoredCard";
import type { AdView } from "@/lib/ads/ads";
import { BUTTON_MAX, CAPTION_MAX, HEADLINE_MAX, KIND_MAX, MEDIA_RULES, NAME_MAX, NOTES_MAX, PLACEMENTS, PLACEMENT_LABEL, STATUS_LABEL, initialsOf, mediaPrefix, prettyNaira, watDay, type AdStatus, type MediaKind, type PaymentStatus, type Placement } from "@/lib/ads/adsCore";
import ExpandSelect from "@/components/ui/ExpandSelect";

interface Org { id: string; name: string; logoUrl: string | null }
interface Data { settings: { enabled: boolean; house: boolean }; ads: AdView[]; organizations: Org[] }
interface Form {
  id: string | null; organizationId: string; advertiserName: string; advertiserKind: string; logoUrl: string; headline: string; caption: string; buttonLabel: string; linkUrl: string;
  mediaKind: MediaKind | ""; mediaUrl: string; mediaType: string; mediaName: string; mediaSize: number; placements: Placement[]; startsOn: string; endsOn: string; priceNaira: string; paymentStatus: PaymentStatus; notes: string;
}

const btn = "min-h-[44px] rounded-full border border-brand-gray px-4 text-sm font-semibold text-brand-ink hover:bg-brand-mint disabled:opacity-60";
const primary = "min-h-[44px] rounded-full bg-brand-action px-5 text-sm font-bold text-brand-onAccent hover:bg-brand-actionHover disabled:opacity-60";
const field = "mt-1 block min-h-[44px] w-full rounded-lg border border-brand-gray bg-brand-surface px-3 text-base text-brand-ink";
const STATUS_VARIANT: Record<AdStatus, "success" | "warning" | "neutral" | "gold" | "danger"> = { LIVE: "success", WAITING_PAYMENT: "warning", SCHEDULED: "gold", PAUSED: "neutral", ENDED: "neutral" };

const blank = (): Form => {
  const today = watDay(new Date());
  return { id: null, organizationId: "", advertiserName: "", advertiserKind: "", logoUrl: "", headline: "", caption: "", buttonLabel: "Learn more", linkUrl: "https://", mediaKind: "", mediaUrl: "", mediaType: "", mediaName: "", mediaSize: 0, placements: ["TOP", "INLINE"], startsOn: today, endsOn: watDay(new Date(Date.now() + 29 * 86_400_000)), priceNaira: "", paymentStatus: "UNPAID", notes: "" };
};
const fromAd = (a: AdView, duplicate: boolean): Form => ({
  id: duplicate ? null : a.id, organizationId: a.organizationId ?? "", advertiserName: a.advertiserName, advertiserKind: a.advertiserKind ?? "", logoUrl: a.logoUrl ?? "", headline: a.headline, caption: a.caption, buttonLabel: a.buttonLabel, linkUrl: a.linkUrl,
  mediaKind: a.mediaKind, mediaUrl: a.mediaUrl, mediaType: a.mediaType, mediaName: a.mediaName, mediaSize: a.mediaSize, placements: a.placements, startsOn: duplicate ? watDay(new Date()) : a.startsOn, endsOn: duplicate ? watDay(new Date(Date.now() + 29 * 86_400_000)) : a.endsOn,
  priceNaira: a.priceKobo == null ? "" : String(Math.round(a.priceKobo / 100)), paymentStatus: duplicate ? "UNPAID" : a.paymentStatus, notes: a.notes ?? "",
});

/** Super Admin: switch ads on, book an ad for an organization (picture or video, words, link, dates, where), record payment, and watch the numbers. */
export default function AdsAdmin() {
  const { showToast } = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/ads", { cache: "no-store" });
    if (!res.ok) { setError("Ads could not be loaded."); return; }
    setData(await res.json()); setError(null);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function post(body: Record<string, unknown>, done?: string) {
    setBusy(true); setProblem(null);
    const res = await fetch("/api/admin/ads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setProblem(json.error ?? "That did not work."); return false; }
    setData(json);
    if (done) showToast(done);
    return true;
  }

  async function upload(kind: "image" | "video" | "logo", file: File | undefined) {
    if (!file || !form) return;
    const rules = MEDIA_RULES[kind === "image" ? "IMAGE" : kind === "video" ? "VIDEO" : "LOGO"];
    if (!rules.types.includes(file.type)) { setProblem(`That is not a ${rules.label}.`); return; }
    if (file.size > rules.maxBytes) { setProblem(`That file is too big. It must be a ${rules.label}.`); return; }
    setUploading(kind); setProblem(null);
    try {
      const blob = await uploadPresigned(`${mediaPrefix(kind)}${file.name}`, file, { access: "public", handleUploadUrl: "/api/admin/ads/upload-token", contentType: file.type });
      setForm((f) => (f ? (kind === "logo" ? { ...f, logoUrl: blob.url } : { ...f, mediaKind: kind === "image" ? "IMAGE" : "VIDEO", mediaUrl: blob.url, mediaType: file.type, mediaName: file.name, mediaSize: file.size }) : f));
    } catch (e) { setProblem(e instanceof Error ? e.message : "Could not upload that file. Try again."); }
    setUploading(null);
  }

  async function save() {
    if (!form) return;
    const { id, priceNaira, ...rest } = form;
    const ad = { ...rest, organizationId: rest.organizationId || null, priceNaira: priceNaira === "" ? null : priceNaira };
    if (await post(id ? { action: "update", id, ad } : { action: "create", ad }, id ? "Ad saved." : "Ad booked.")) setForm(null);
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <SkeletonList rows={3} />;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const togglePlace = (p: Placement) => form && set("placements", form.placements.includes(p) ? form.placements.filter((x) => x !== p) : [...form.placements, p]);
  const org = form ? data.organizations.find((o) => o.id === form.organizationId) : null;

  return (
    <div data-testid="ads-admin">
      <Card>
        <h2 className="font-semibold text-brand-ink">Ads on the platform</h2>
        <label className="mt-3 flex min-h-[44px] items-start gap-3 text-sm text-brand-ink">
          <input type="checkbox" className="mt-1 h-5 w-5" checked={data.settings.enabled} disabled={busy} onChange={(e) => void post({ action: "settings", enabled: e.target.checked }, e.target.checked ? "Ads are on." : "Ads are off.")} data-testid="ads-master" />
          <span><span className="font-semibold">Show ads on the feed and the About page.</span><br /><span className="text-gray-600">Off until you switch it on. While it is off, no paid ad is shown anywhere.</span></span>
        </label>
        <label className="mt-2 flex min-h-[44px] items-start gap-3 text-sm text-brand-ink">
          <input type="checkbox" className="mt-1 h-5 w-5" checked={data.settings.house} disabled={busy} onChange={(e) => void post({ action: "settings", house: e.target.checked }, "Saved.")} data-testid="ads-house" />
          <span><span className="font-semibold">Show our own play card when no paid ad is running.</span><br /><span className="text-gray-600">Fills the top of the feed and the About page. Never shown between posts.</span></span>
        </label>
      </Card>

      {problem && !form && <p role="alert" className="mt-3 text-sm text-brand-rose">{problem}</p>}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-brand-ink">Booked ads</h2>
        <button type="button" className={primary} onClick={() => { setProblem(null); setForm(blank()); }} data-testid="ad-new">Book an ad</button>
      </div>

      {form && (
        <Card className="mt-3" >
          <div data-testid="ad-form">
          <h3 className="font-semibold text-brand-ink">{form.id ? "Edit this ad" : "Book an ad"}</h3>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <label className="block text-sm"><span className="font-semibold text-brand-ink">Organization (optional)</span>
                <ExpandSelect className={field} value={form.organizationId} data-testid="ad-org" onChange={(e) => { const o = data.organizations.find((x) => x.id === e.target.value); setForm((f) => (f ? { ...f, organizationId: e.target.value, advertiserName: o && !f.advertiserName ? o.name : f.advertiserName } : f)); }}>
                  <option value="">Not an AAICBI organization</option>
                  {data.organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </ExpandSelect>
                <span className="text-xs text-gray-600">An organization sees its own numbers in the Ads report.</span>
              </label>
              <label className="block text-sm"><span className="font-semibold text-brand-ink">Advertiser name</span><input className={field} maxLength={NAME_MAX} value={form.advertiserName} onChange={(e) => set("advertiserName", e.target.value)} data-testid="ad-name" /></label>
              <label className="block text-sm"><span className="font-semibold text-brand-ink">Type (optional, shown under the name)</span><input className={field} maxLength={KIND_MAX} value={form.advertiserKind} onChange={(e) => set("advertiserKind", e.target.value)} placeholder="Training organization" /></label>
              <div className="text-sm"><span className="font-semibold text-brand-ink">Logo (optional)</span>
                <p className="text-xs text-gray-600">{org?.logoUrl && !form.logoUrl ? "The organization's own logo is used unless you upload one." : MEDIA_RULES.LOGO.label}</p>
                <input type="file" accept={MEDIA_RULES.LOGO.types.join(",")} className="mt-1 block text-sm" onChange={(e) => void upload("logo", e.target.files?.[0])} data-testid="ad-logo-file" />
                {form.logoUrl && <button type="button" className="mt-1 text-xs font-semibold text-brand-teal underline" onClick={() => set("logoUrl", "")}>Remove logo</button>}
              </div>
              <div className="text-sm"><span className="font-semibold text-brand-ink">Picture or video</span>
                <p className="text-xs text-gray-600">{MEDIA_RULES.IMAGE.label}, or a {MEDIA_RULES.VIDEO.label}. A wide 16:9 shape looks best.</p>
                <div className="mt-1 flex flex-wrap gap-3">
                  <label className="text-xs">Picture <input type="file" accept={MEDIA_RULES.IMAGE.types.join(",")} onChange={(e) => void upload("image", e.target.files?.[0])} data-testid="ad-image-file" /></label>
                  <label className="text-xs">Video <input type="file" accept={MEDIA_RULES.VIDEO.types.join(",")} onChange={(e) => void upload("video", e.target.files?.[0])} data-testid="ad-video-file" /></label>
                </div>
                {uploading && <p className="mt-1 text-xs text-gray-600" role="status">Uploading {uploading}…</p>}
                {form.mediaUrl && <p className="mt-1 text-xs text-brand-ink">Ready: {form.mediaName}</p>}
              </div>
              <label className="block text-sm"><span className="font-semibold text-brand-ink">Headline ({form.headline.length}/{HEADLINE_MAX})</span><input className={field} maxLength={HEADLINE_MAX} value={form.headline} onChange={(e) => set("headline", e.target.value)} data-testid="ad-headline" /></label>
              <label className="block text-sm"><span className="font-semibold text-brand-ink">Caption ({form.caption.length}/{CAPTION_MAX})</span><textarea className={`${field} py-2`} rows={3} maxLength={CAPTION_MAX} value={form.caption} onChange={(e) => set("caption", e.target.value)} data-testid="ad-caption" /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm"><span className="font-semibold text-brand-ink">Button words</span><input className={field} maxLength={BUTTON_MAX} value={form.buttonLabel} onChange={(e) => set("buttonLabel", e.target.value)} data-testid="ad-button" /></label>
                <label className="block text-sm"><span className="font-semibold text-brand-ink">Link (https only)</span><input className={field} inputMode="url" value={form.linkUrl} onChange={(e) => set("linkUrl", e.target.value)} data-testid="ad-link" /></label>
              </div>
              <fieldset className="text-sm"><legend className="font-semibold text-brand-ink">Where it shows</legend>
                {PLACEMENTS.map((p) => <label key={p} className="flex min-h-[44px] items-center gap-3"><input type="checkbox" className="h-5 w-5" checked={form.placements.includes(p)} onChange={() => togglePlace(p)} data-testid={`ad-place-${p}`} />{PLACEMENT_LABEL[p]}</label>)}
              </fieldset>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm"><span className="font-semibold text-brand-ink">First day (Nigerian time)</span><input type="date" className={field} value={form.startsOn} onChange={(e) => set("startsOn", e.target.value)} data-testid="ad-start" /></label>
                <label className="block text-sm"><span className="font-semibold text-brand-ink">Last day (Nigerian time)</span><input type="date" className={field} value={form.endsOn} onChange={(e) => set("endsOn", e.target.value)} data-testid="ad-end" /></label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm"><span className="font-semibold text-brand-ink">Price agreed (₦, optional)</span><input inputMode="numeric" className={field} value={form.priceNaira} onChange={(e) => set("priceNaira", e.target.value)} data-testid="ad-price" /></label>
                <label className="block text-sm"><span className="font-semibold text-brand-ink">Payment</span>
                  <ExpandSelect className={field} value={form.paymentStatus} onChange={(e) => set("paymentStatus", e.target.value as PaymentStatus)} data-testid="ad-payment"><option value="UNPAID">Not paid yet (will not go live)</option><option value="PAID">Paid</option><option value="FREE">Free (no charge)</option></ExpandSelect>
                </label>
              </div>
              <label className="block text-sm"><span className="font-semibold text-brand-ink">Private note (never shown)</span><textarea className={`${field} py-2`} rows={2} maxLength={NOTES_MAX} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Receipt number, who agreed it…" /></label>
            </div>
            <div>
              <p className="text-sm font-semibold text-brand-ink">How it will look</p>
              <div className="mt-2 max-w-md" data-testid="ad-preview">
                {form.mediaUrl && form.mediaKind ? (
                  <SponsoredCard preview ad={{ id: "preview", advertiser: { name: form.advertiserName || "Advertiser", kind: form.advertiserKind || null, logoUrl: form.logoUrl || org?.logoUrl || null, initials: initialsOf(form.advertiserName || "Advertiser") }, headline: form.headline || "Your headline", caption: form.caption || "Your caption", buttonLabel: form.buttonLabel || "Learn more", media: { kind: form.mediaKind, url: form.mediaUrl }, goUrl: "#" }} />
                ) : <p className="rounded-2xl border border-dashed border-brand-gray p-6 text-sm text-gray-600">Upload a picture or video to see the card.</p>}
              </div>
            </div>
          </div>
          {problem && <p role="alert" className="mt-3 text-sm text-brand-rose" data-testid="ad-problem">{problem}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={primary} disabled={busy || !!uploading} onClick={() => void save()} data-testid="ad-save">{form.id ? "Save changes" : "Book this ad"}</button>
            <button type="button" className={btn} onClick={() => { setForm(null); setProblem(null); }}>Cancel</button>
          </div>
          </div>
        </Card>
      )}

      <ul className="mt-3 space-y-3" data-testid="ad-list">
        {data.ads.length === 0 && <li><Card><p className="text-sm text-brand-ink">No ads booked yet.</p></Card></li>}
        {data.ads.map((a) => (
          <li key={a.id} data-testid="ad-row" data-ad-id={a.id}>
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-brand-ink">{a.headline}</p>
                  <p className="text-sm text-gray-700">{a.advertiserName}{a.organizationName ? " · organization" : ""} · {a.startsOn} to {a.endsOn}{a.status === "LIVE" ? ` · ${a.daysLeft} day${a.daysLeft === 1 ? "" : "s"} left` : ""}</p>
                  <p className="text-sm text-gray-700">{a.placements.map((p) => PLACEMENT_LABEL[p]).join(" · ")}</p>
                </div>
                <div className="flex flex-wrap gap-1"><Badge variant={STATUS_VARIANT[a.status]}>{STATUS_LABEL[a.status]}</Badge><Badge variant={a.paymentStatus === "UNPAID" ? "warning" : "success"}>{a.paymentStatus === "PAID" ? `Paid ${prettyNaira(a.priceKobo)}` : a.paymentStatus === "FREE" ? "Free" : `Unpaid ${prettyNaira(a.priceKobo)}`}</Badge></div>
              </div>
              <p className="mt-2 text-sm text-brand-ink" data-testid="ad-numbers">{a.views.toLocaleString()} views · {a.taps.toLocaleString()} taps · {a.tapRate}% tap rate</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={btn} disabled={busy} onClick={() => { setProblem(null); setForm(fromAd(a, false)); }}>Edit</button>
                <button type="button" className={btn} disabled={busy} onClick={() => { setProblem(null); setForm(fromAd(a, true)); }}>Duplicate</button>
                <button type="button" className={btn} disabled={busy} data-testid="ad-pause" onClick={() => void post({ action: "pause", id: a.id, paused: !a.paused }, a.paused ? "Resumed." : "Paused.")}>{a.paused ? "Resume" : "Pause"}</button>
                {a.paymentStatus !== "PAID" && <button type="button" className={btn} disabled={busy} data-testid="ad-mark-paid" onClick={() => void post({ action: "payment", id: a.id, status: "PAID" }, "Marked paid.")}>Mark paid</button>}
                {a.paymentStatus !== "UNPAID" && <button type="button" className={btn} disabled={busy} data-testid="ad-mark-unpaid" onClick={() => void post({ action: "payment", id: a.id, status: "UNPAID" }, "Marked unpaid. It is no longer shown.")}>Mark unpaid</button>}
                {a.paymentStatus !== "FREE" && <button type="button" className={btn} disabled={busy} onClick={() => void post({ action: "payment", id: a.id, status: "FREE" }, "Marked free.")}>Mark free</button>}
                <button type="button" className={`${btn} text-brand-rose`} disabled={busy} data-testid="ad-delete" onClick={() => { if (window.confirm("Delete this ad and its numbers?")) void post({ action: "delete", id: a.id }, "Ad deleted."); }}>Delete</button>
              </div>
              {a.notes && <p className="mt-2 text-xs text-gray-600">Note: {a.notes}</p>}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
