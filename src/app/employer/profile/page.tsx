"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/employer/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import ProfileCompletionBanner from "@/components/ui/ProfileCompletionBanner";
import { computeEmployerCompletion } from "@/lib/profileCompletion";
import AvatarUpload from "@/components/AvatarUpload";

const NAV = [
  { label: "Dashboard", href: "/employer/dashboard" },
  { label: "Discover", href: "/employer/discover" },
  { label: "My Introductions", href: "/employer/introductions" },
  { label: "Job Postings", href: "/employer/job-postings" },
  { label: "My Profile", href: "/employer/profile" },
  { label: "Account", href: "/employer/status" },
  { label: "Settings", href: "/employer/settings" },
];

interface ProfileData {
  companyName: string;
  logoUrl: string | null;
  industry: string | null;
  companySize: string | null;
  location: string | null;
  description: string | null;
  website: string | null;
  linkedinUrl: string | null;
  otherSocialUrl: string | null;
  approvalState: "PENDING" | "APPROVED" | "REJECTED";
  profileVisibility: string;
  activeVacancies: { id: string; title: string; closingDate: string }[];
  skillsSought: { id: string; name: string }[];
}

const VISIBILITY_LABELS: Record<string, string> = {
  PUBLIC: "Public — anyone, no sign-in required",
  AUTHENTICATED: "Any signed-in AAICBI account",
  EMPLOYERS_ONLY: "Approved employers only",
  PRIVATE: "Private — only you and admins",
};

/**
 * Universal profile system, Phase 2 — the employer's own company
 * profile. "Active vacancies" and "skills sought" are read-only here,
 * derived from this employer's real job postings (see the API route's
 * own comment) — nothing to edit twice in two places. Verification
 * status reuses M30's existing approvalState rather than inventing a
 * second one.
 */
export default function EmployerProfilePage() {
  const { showToast } = useToast();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [form, setForm] = useState({ industry: "", companySize: "", location: "", description: "", profileVisibility: "AUTHENTICATED" });
  const [saving, setSaving] = useState(false);

  function load() {
    setLoadError(false);
    setProfile(null);
    fetch("/api/employer/profile")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: ProfileData) => {
        setProfile(data);
        setLogoUrl(data.logoUrl);
        setForm({
          industry: data.industry ?? "",
          companySize: data.companySize ?? "",
          location: data.location ?? "",
          description: data.description ?? "",
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
    const res = await fetch("/api/employer/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      showToast("Could not save. Try again.", "error");
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
          <ErrorState message="We couldn't load your company profile." onRetry={load} />
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-brand-mint">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl text-brand-teal">🏢</div>
            )}
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold text-brand-ink">{profile?.companyName ?? "Company Profile"}</h1>
            {profile && (
              <Badge variant={profile.approvalState === "APPROVED" ? "success" : profile.approvalState === "REJECTED" ? "danger" : "warning"}>
                {profile.approvalState === "APPROVED" ? "✓ Verified Employer" : profile.approvalState === "REJECTED" ? "Not Approved" : "Pending Review"}
              </Badge>
            )}
          </div>
        </div>

        {profile === null ? (
          <div className="mt-6">
            <SkeletonList rows={3} />
          </div>
        ) : (
          <>
            <ProfileCompletionBanner
              {...computeEmployerCompletion({
                logoUrl,
                industry: profile.industry,
                companySize: profile.companySize,
                location: profile.location,
                description: profile.description,
                hasSocialLink: !!(profile.website || profile.linkedinUrl || profile.otherSocialUrl),
                activeVacancyCount: profile.activeVacancies.length,
              })}
            />

            <Card className="mt-6">
              <p className="font-display font-semibold text-brand-ink">Company Logo</p>
              <div className="mt-3">
                <AvatarUpload avatarUrl={logoUrl} apiPath="/api/employer/logo" onChange={setLogoUrl} />
              </div>
            </Card>

            <Card className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Company Details</p>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-sm font-semibold text-brand-ink">Industry</label>
                  <input
                    value={form.industry}
                    onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
                    placeholder="e.g. Financial Services"
                    className="mt-1 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-brand-ink">Company size</label>
                  <input
                    value={form.companySize}
                    onChange={(e) => setForm((f) => ({ ...f, companySize: e.target.value }))}
                    placeholder="e.g. 11-50 employees"
                    className="mt-1 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-brand-ink">Location</label>
                  <input
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    placeholder="e.g. Lagos, Nigeria"
                    className="mt-1 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-brand-ink">About the company</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={4}
                    className="mt-1 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
                  />
                </div>
              </div>
              <div className="mt-4">
                <Button size="sm" onClick={save} loading={saving}>
                  Save
                </Button>
              </div>
            </Card>

            <Card className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Profile Visibility</p>
              <p className="mt-1 text-xs text-gray-500">
                Who can view this company profile. Independent of your job postings and Discover listing.
              </p>
              <select
                value={form.profileVisibility}
                onChange={(e) => setForm((f) => ({ ...f, profileVisibility: e.target.value }))}
                className="mt-2 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
              >
                {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <div className="mt-3">
                <Button size="sm" onClick={save} loading={saving}>
                  Save
                </Button>
              </div>
            </Card>

            <Card className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Links</p>
              <p className="mt-2 text-xs text-gray-500">
                Website, LinkedIn, and social links are set at registration. Contact support to change them.
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-sm">
                {profile.website && (
                  <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-brand-teal hover:underline">
                    Website
                  </a>
                )}
                {profile.linkedinUrl && (
                  <a href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-brand-teal hover:underline">
                    LinkedIn
                  </a>
                )}
                {profile.otherSocialUrl && (
                  <a href={profile.otherSocialUrl} target="_blank" rel="noopener noreferrer" className="text-brand-teal hover:underline">
                    Other
                  </a>
                )}
                {!profile.website && !profile.linkedinUrl && !profile.otherSocialUrl && (
                  <p className="text-sm text-gray-500">No links on file.</p>
                )}
              </div>
            </Card>

            <Card className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Active Vacancies</p>
              {profile.activeVacancies.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">
                  No approved postings right now.{" "}
                  <a href="/employer/job-postings" className="text-brand-teal hover:underline">
                    Post a vacancy
                  </a>
                  .
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {profile.activeVacancies.map((v) => (
                    <li key={v.id} className="text-sm text-brand-ink">
                      {v.title}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Skills We're Hiring For</p>
              {profile.skillsSought.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">
                  Add skills to your job postings to show what you're hiring for here.
                </p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {profile.skillsSought.map((s) => (
                    <li key={s.id} className="rounded-full bg-brand-mint px-2.5 py-1 text-xs font-medium text-brand-teal">
                      {s.name}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </main>
    </>
  );
}
