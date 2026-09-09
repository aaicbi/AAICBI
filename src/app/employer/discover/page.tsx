"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/employer/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import EmptyState from "@/components/ui/EmptyState";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";

interface TraineeListing {
  id: string;
  name: string;
  headline: string | null;
  bio: string | null;
  location: string | null;
  openToWork: boolean;
  employmentStatus: string | null;
  availabilityTypes: string[];
  skills: string[];
  certificates: { code: string; courseTitle: string }[];
}

const NAV = [
  { label: "Dashboard", href: "/employer/dashboard" },
  { label: "Discover", href: "/employer/discover" },
  { label: "My Introductions", href: "/employer/introductions" },
  { label: "Job Postings", href: "/employer/job-postings" },
  { label: "My Profile", href: "/employer/profile" },
  { label: "Account", href: "/employer/status" },
  { label: "Settings", href: "/employer/settings" },
];

const AVAILABILITY_LABELS: Record<string, string> = {
  INTERNSHIP: "Internship",
  FREELANCE: "Freelance",
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
};

/**
 * M33 — the actual browsing surface. A 404 from the API here (an
 * unapproved employer somehow reaching this page directly) shows a
 * clear message rather than a broken "failed to load" state — the
 * same honest handling this project applies wherever an access gate
 * could plausibly be hit by a real, non-malicious visit.
 */
export default function EmployerDiscoverPage() {
  const [trainees, setTrainees] = useState<TraineeListing[] | null>(null);
  const [notApproved, setNotApproved] = useState(false);
  const [traineesError, setTraineesError] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [message, setMessage] = useState<Record<string, string>>({});
  const { showToast } = useToast();

  const [filters, setFilters] = useState({ skill: "", location: "", availability: "", employmentStatus: "" });
  const [appliedFilters, setAppliedFilters] = useState(filters);

  function load(activeFilters = appliedFilters) {
    setTraineesError(false);
    const params = new URLSearchParams();
    if (activeFilters.skill) params.set("skill", activeFilters.skill);
    if (activeFilters.location) params.set("location", activeFilters.location);
    if (activeFilters.availability) params.set("availability", activeFilters.availability);
    if (activeFilters.employmentStatus) params.set("employmentStatus", activeFilters.employmentStatus);
    const qs = params.toString();
    fetch(`/api/employer/discover${qs ? `?${qs}` : ""}`)
      .then((r) => {
        if (r.status === 404) {
          setNotApproved(true);
          return [];
        }
        return r.ok ? r.json() : Promise.reject();
      })
      .then(setTrainees)
      .catch(() => setTraineesError(true));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyFilters() {
    setAppliedFilters(filters);
    setTrainees(null);
    load(filters);
  }

  function clearFilters() {
    const cleared = { skill: "", location: "", availability: "", employmentStatus: "" };
    setFilters(cleared);
    setAppliedFilters(cleared);
    setTrainees(null);
    load(cleared);
  }

  async function sendIntroduction(traineeId: string) {
    setSendingTo(traineeId);
    const res = await fetch("/api/employer/introductions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ traineeId, message: message[traineeId] || undefined }),
    });
    setSendingTo(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not send. Try again.", "error");
      return;
    }
    showToast("Introduction sent.");
  }

  if (notApproved) {
    return (
      <>
        <SiteHeader right={<LogoutButton />} />
        <main className="mx-auto max-w-md px-6 py-16 text-center">
          <p className="text-sm text-gray-600">Your account needs to be approved before you can browse trainees.</p>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Discover Trainees</h1>
        <p className="mt-1 text-sm text-gray-500">
          Contact information is never shown here — express interest, and the trainee decides what to share.
        </p>

        <Card className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Filter</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              value={filters.skill}
              onChange={(e) => setFilters((f) => ({ ...f, skill: e.target.value }))}
              placeholder="Skill, e.g. React"
              className="rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
            />
            <input
              value={filters.location}
              onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}
              placeholder="Location"
              className="rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
            />
            <select
              value={filters.availability}
              onChange={(e) => setFilters((f) => ({ ...f, availability: e.target.value }))}
              className="rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
            >
              <option value="">Any availability</option>
              {Object.entries(AVAILABILITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={filters.employmentStatus}
              onChange={(e) => setFilters((f) => ({ ...f, employmentStatus: e.target.value }))}
              className="rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
            >
              <option value="">Any employment status</option>
              <option value="STUDENT">Student</option>
              <option value="EMPLOYED">Employed</option>
              <option value="UNEMPLOYED">Unemployed</option>
              <option value="SELF_EMPLOYED">Self-employed</option>
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={applyFilters}>
              Apply
            </Button>
            <button onClick={clearFilters} className="text-xs font-semibold text-gray-500 hover:text-brand-teal">
              Clear
            </button>
          </div>
        </Card>

        <div className="mt-4 space-y-3">
          {traineesError ? (
            <ErrorState message="We couldn't load discoverable trainees." onRetry={load} />
          ) : trainees === null ? (
            <SkeletonList />
          ) : trainees.length === 0 ? (
            <EmptyState
              illustration={<GrowthPathDoodle className="h-full w-full" />}
              title="No trainees are currently discoverable"
              description="Check back soon — trainees choose when to make themselves visible here."
            />
          ) : (
            trainees.map((t) => (
              <Card key={t.id}>
                <p className="font-display font-semibold text-brand-ink">{t.name}</p>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                  {t.location && <span>{t.location}</span>}
                  {t.openToWork && (
                    <span className="rounded-full bg-brand-mint px-2 py-0.5 font-semibold text-brand-tealDeep">
                      Open to work
                    </span>
                  )}
                  {t.availabilityTypes.map((a) => (
                    <span key={a} className="rounded-full bg-brand-gray/40 px-2 py-0.5">
                      {AVAILABILITY_LABELS[a] ?? a}
                    </span>
                  ))}
                </div>
                {t.headline && <p className="mt-0.5 text-sm text-gray-700">{t.headline}</p>}
                {t.bio && <p className="mt-1 text-sm text-gray-600">{t.bio}</p>}
                {t.skills.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {t.skills.map((s) => (
                      <li key={s} className="rounded-full border border-brand-gray px-2.5 py-1 text-xs text-brand-ink">
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
                {t.certificates.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {t.certificates.map((c) => (
                      <li key={c.code} className="rounded-full bg-brand-mint px-2.5 py-1 text-xs font-medium text-brand-teal">
                        {c.courseTitle}
                      </li>
                    ))}
                  </ul>
                )}
                <textarea
                  value={message[t.id] ?? ""}
                  onChange={(e) => setMessage((m) => ({ ...m, [t.id]: e.target.value }))}
                  placeholder="Add a short note (optional)"
                  aria-label="Note to trainee (optional)"
                  rows={2}
                  className="mt-3 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
                />
                <Button size="sm" onClick={() => sendIntroduction(t.id)} loading={sendingTo === t.id} className="mt-2">
                  Express Interest
                </Button>
              </Card>
            ))
          )}
        </div>
      </main>
    </>
  );
}
