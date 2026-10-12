"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Toggle from "@/components/ui/Toggle";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Input, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import StickyActions from "@/components/ui/StickyActions";
import VerifiedBadge from "./VerifiedBadge";
import OrgProfilePreview from "./OrgProfilePreview";
import ImageFramer, { loadAsFile } from "@/components/ui/ImageFramer";
import AvatarUpload from "@/components/AvatarUpload";
import { COVER_ASPECT, COVER_PHONE_ASPECT } from "@/lib/imageFrame";

interface ProfileDto {
  slug: string; tagline: string | null; description: string | null; location: string | null;
  coverUrl: string | null; publicEnabled: boolean; verified: boolean;
}

export default function OrgPublicProfileForm() {
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [org, setOrg] = useState<{ name: string; logoUrl: string | null }>({ name: "Your organization", logoUrl: null });
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  function load() {
    setLoadError(false);
    fetch("/api/org/profile").then((r) => (r.ok ? r.json() : Promise.reject())).then((d) => {
        setProfile(d.profile);
        setOrg({ name: d.organizationName ?? "Your organization", logoUrl: d.logoUrl ?? null });
      }).catch(() => setLoadError(true));
  }
  useEffect(load, []);

  if (loadError) return <ErrorState message="Could not load your public profile." onRetry={load} />;
  if (!profile) return <SkeletonList rows={4} />;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/org/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: profile.slug,
        tagline: profile.tagline ?? "",
        description: profile.description ?? "",
        location: profile.location ?? "",
        coverUrl: profile.coverUrl ?? "",
        publicEnabled: profile.publicEnabled,
      }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error ?? "Could not save.");
    setProfile(data.profile);
    showToast("Public profile saved.", "success");
  }

  // Opens the picture that is already on the page, so it can be moved or zoomed again.
  async function adjustCover() {
    if (!profile?.coverUrl) return;
    setError(null);
    const f = await loadAsFile(profile.coverUrl, "cover");
    if (!f) return setError("Could not open the saved picture to adjust it. Choose the picture again with Change picture.");
    setPending(f);
  }

  async function uploadCover(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/org/profile/cover", { method: "POST", body }).catch(() => null);
    setUploading(false);
    const data = (await res?.json().catch(() => ({}))) ?? {};
    if (!res?.ok) return setError(data.error ?? "Could not upload that picture.");
    set({ coverUrl: data.url });
    showToast("Picture added. Press Save to publish it on your page.", "success");
  }

  const set = (patch: Partial<ProfileDto>) => setProfile({ ...profile, ...patch });

  return (
    <>
    <form onSubmit={save}>
      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-brand-ink">Show my organization page publicly</p>
            <p className="text-xs text-gray-600">Off by default. Your page also needs the platform's public pages to be switched on.</p>
          </div>
          <Toggle checked={profile.publicEnabled} onChange={(v) => set({ publicEnabled: v })} label="Show my organization page publicly" />
        </div>
        {profile.verified && <VerifiedBadge />}
        <Input label="Page address" value={profile.slug} onChange={(e) => set({ slug: e.target.value.toLowerCase() })} required hint={`aaicbi.org/organizations/${profile.slug}`} />
        <Input label="Tagline" value={profile.tagline ?? ""} onChange={(e) => set({ tagline: e.target.value })} maxLength={140} />
        <Input label="Location" value={profile.location ?? ""} onChange={(e) => set({ location: e.target.value })} maxLength={120} />
        <div>
          <p className="text-sm font-semibold text-brand-ink">Organization picture</p>
          <p className="mb-2 text-xs text-gray-600">Your logo or profile picture. It shows on your public page, your profile, search and the feed, instead of a letter.</p>
          <AvatarUpload avatarUrl={org.logoUrl} apiPath="/api/org/profile/logo" square onChange={(u) => setOrg((o) => ({ ...o, logoUrl: u }))} />
        </div>
        <div>
          <p className="text-sm font-semibold text-brand-ink">Cover picture</p>
          {profile.coverUrl && (
            <div className="mt-2 aspect-[16/5] max-w-md overflow-hidden rounded-2xl bg-brand-sand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={profile.coverUrl} alt="Your cover picture" className="no-ring h-full w-full object-cover" />
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="org-cover-file" onChange={(e) => { setPending(e.target.files?.[0] ?? null); e.target.value = ""; }} />
            <label htmlFor="org-cover-file" className="inline-flex min-h-[44px] cursor-pointer items-center rounded-full border border-brand-action px-5 text-sm font-semibold text-brand-action hover:bg-brand-mint focus-within:ring-2 focus-within:ring-brand-teal">
              {uploading ? "Uploading…" : profile.coverUrl ? "Change picture" : "Upload a picture"}
            </label>
            {profile.coverUrl && <button type="button" onClick={adjustCover} className="inline-flex min-h-[44px] items-center rounded-full border border-brand-gray px-5 text-sm font-semibold text-brand-ink hover:bg-brand-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">Adjust picture</button>}
            {profile.coverUrl && <button type="button" onClick={() => set({ coverUrl: "" })} className="min-h-[44px] text-sm font-semibold text-brand-rose hover:underline">Remove</button>}
          </div>
          <p className="mt-1 text-xs text-gray-600">JPG, PNG or WEBP, up to 5MB. You can drag and zoom the picture to place it before it is added.</p>
        </div>
        <Textarea label="About" rows={6} value={profile.description ?? ""} onChange={(e) => set({ description: e.target.value })} maxLength={2000} />
        {error && <p role="alert" className="text-sm text-brand-rose">{error}</p>}
        <StickyActions>
          <Button type="submit" loading={saving}>Save</Button>
          {profile.publicEnabled && <Link href={`/organizations/${profile.slug}`} className="text-sm font-semibold text-brand-teal hover:underline">View page</Link>}
        </StickyActions>
      </Card>
    </form>
    <ImageFramer
      file={pending}
      aspect={COVER_ASPECT}
      title="Place your cover picture"
      alsoShow={[{ label: "On a phone", aspect: COVER_PHONE_ASPECT }]}
      context={
        <div className="p-4">
          {org.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- the organization's own uploaded logo.
            <img src={org.logoUrl} alt="" className="relative -mt-12 h-16 w-16 rounded-xl border-4 border-brand-surface bg-brand-surface object-cover" />
          ) : (
            <span className="relative -mt-12 flex h-16 w-16 items-center justify-center rounded-xl border-4 border-brand-surface bg-brand-mint text-xl font-semibold text-brand-teal">{org.name.slice(0, 1)}</span>
          )}
          <p className="mt-2 font-display text-lg font-semibold text-brand-ink">{org.name}</p>
          {profile.tagline?.trim() && <p className="text-sm text-gray-700">{profile.tagline}</p>}
        </div>
      }
      onCancel={() => setPending(null)}
      onDone={(f) => { setPending(null); uploadCover(f); }}
      onUnreadable={(f) => { setPending(null); uploadCover(f); }}
    />
    <OrgProfilePreview
      name={org.name}
      logoUrl={org.logoUrl}
      slug={profile.slug}
      tagline={profile.tagline ?? ""}
      description={profile.description ?? ""}
      location={profile.location ?? ""}
      coverUrl={profile.coverUrl ?? ""}
      verified={profile.verified}
      publicEnabled={profile.publicEnabled}
    />
    </>
  );
}
