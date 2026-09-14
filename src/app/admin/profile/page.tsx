"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import AvatarFallback from "@/components/ui/AvatarFallback";
import AvatarUpload from "@/components/AvatarUpload";
import Toggle from "@/components/ui/Toggle";
import ProfileCompletionBanner from "@/components/ui/ProfileCompletionBanner";
import { computeAdminCompletion } from "@/lib/profileCompletion";

const NAV = [
  { label: "Examinations", href: "/admin/dashboard" },
  { label: "Courses", href: "/admin/courses" },
  { label: "My Profile", href: "/admin/profile" },
  { label: "Settings", href: "/admin/settings" },
];

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  INSTRUCTOR: "Instructor",
};

interface AdminProfile {
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  username: string | null;
  bio: string | null;
  jobTitle: string | null;
  department: string | null;
  areasOfResponsibility: string | null;
  profileVisibility: "PRIVATE" | "AUTHENTICATED";
}

/**
 * Universal profile system, Phase 3 — a staff member's own profile.
 * "Permission level" shows the existing `role` read-only (changed only
 * by a SUPER_ADMIN via /admin/staff, never here); "activity history"
 * isn't rendered on this page — it's implicit across the existing
 * admin areas (employer approvals, job posting reviews, etc.) rather
 * than duplicated into a feed here, keeping this page focused on what
 * the caller can actually self-edit.
 */
export default function AdminProfilePage() {
  const { showToast } = useToast();
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    username: "",
    bio: "",
    jobTitle: "",
    department: "",
    areasOfResponsibility: "",
    profileVisibility: "PRIVATE" as "PRIVATE" | "AUTHENTICATED",
  });
  const [saving, setSaving] = useState(false);

  function load() {
    setLoadError(false);
    setProfile(null);
    fetch("/api/admin/profile")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: AdminProfile) => {
        setProfile(data);
        setAvatarUrl(data.avatarUrl);
        setForm({
          username: data.username ?? "",
          bio: data.bio ?? "",
          jobTitle: data.jobTitle ?? "",
          department: data.department ?? "",
          areasOfResponsibility: data.areasOfResponsibility ?? "",
          profileVisibility: data.profileVisibility,
        });
      })
      .catch(() => setLoadError(true));
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/admin/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not save. Try again.", "error");
      return;
    }
    showToast("Saved.");
    load();
  }

  if (loadError) {
    return (
      <>
        <SiteHeader nav={NAV} right={<LogoutButton />} />
        <main className="mx-auto max-w-2xl px-6 py-10">
          <ErrorState message="We couldn't load your profile." onRetry={load} />
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-brand-mint">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <AvatarFallback size="lg" />
              </div>
            )}
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold text-brand-ink">{profile?.name ?? "My Profile"}</h1>
            {profile && <Badge variant="neutral">{ROLE_LABELS[profile.role] ?? profile.role}</Badge>}
          </div>
        </div>

        {profile === null ? (
          <div className="mt-6">
            <SkeletonList rows={3} />
          </div>
        ) : (
          <>
            <ProfileCompletionBanner
              {...computeAdminCompletion({
                avatarUrl,
                username: profile.username,
                jobTitle: profile.jobTitle,
                department: profile.department,
                bio: profile.bio,
                areasOfResponsibility: profile.areasOfResponsibility,
              })}
            />

            <Card className="mt-6">
              <p className="font-display font-semibold text-brand-ink">Profile Picture</p>
              <div className="mt-3">
                <AvatarUpload avatarUrl={avatarUrl} apiPath="/api/admin/avatar" onChange={setAvatarUrl} />
              </div>
            </Card>

            <Card className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Profile Details</p>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-sm font-semibold text-brand-ink">Username</label>
                  <input
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-brand-ink">Job title</label>
                  <input
                    value={form.jobTitle}
                    onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
                    placeholder="e.g. Programme Coordinator"
                    className="mt-1 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-brand-ink">Department</label>
                  <input
                    value={form.department}
                    onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                    placeholder="e.g. Training Operations"
                    className="mt-1 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-brand-ink">Areas of responsibility</label>
                  <textarea
                    value={form.areasOfResponsibility}
                    onChange={(e) => setForm((f) => ({ ...f, areasOfResponsibility: e.target.value }))}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-brand-ink">Bio</label>
                  <textarea
                    value={form.bio}
                    onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
                  />
                </div>
                <div className="flex items-start justify-between gap-4 border-t border-brand-gray pt-3">
                  <div>
                    <p className="text-sm font-semibold text-brand-ink">Visible to signed-in accounts</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Off keeps this profile private to you and other admins — never public. Staff profiles can never
                      be made public here, by design.
                    </p>
                  </div>
                  <Toggle
                    checked={form.profileVisibility === "AUTHENTICATED"}
                    onChange={(next) => setForm((f) => ({ ...f, profileVisibility: next ? "AUTHENTICATED" : "PRIVATE" }))}
                    label="Visible to signed-in accounts"
                  />
                </div>
              </div>
              <div className="mt-4">
                <Button size="sm" onClick={save} loading={saving}>
                  Save
                </Button>
              </div>
            </Card>
          </>
        )}
      </main>
    </>
  );
}
