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
import VerifiedBadge from "./VerifiedBadge";
import OrgProfilePreview from "./OrgProfilePreview";

interface ProfileDto {
  slug: string; tagline: string | null; description: string | null; location: string | null;
  coverUrl: string | null; publicEnabled: boolean; verified: boolean;
}

export default function OrgPublicProfileForm() {
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [org, setOrg] = useState<{ name: string; logoUrl: string | null }>({ name: "Your organization", logoUrl: null });
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
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
        <Input label="Cover image URL" value={profile.coverUrl ?? ""} onChange={(e) => set({ coverUrl: e.target.value })} placeholder="https://" />
        <Textarea label="About" rows={6} value={profile.description ?? ""} onChange={(e) => set({ description: e.target.value })} maxLength={2000} />
        {error && <p role="alert" className="text-sm text-brand-rose">{error}</p>}
        <div className="flex items-center gap-3">
          <Button type="submit" loading={saving}>Save</Button>
          {profile.publicEnabled && <Link href={`/organizations/${profile.slug}`} className="text-sm font-semibold text-brand-teal hover:underline">View page</Link>}
        </div>
      </Card>
    </form>
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
