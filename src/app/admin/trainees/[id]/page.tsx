"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import BackLink from "@/components/ui/BackLink";
import { MapPin } from "lucide-react";
import Icon from "@/components/ui/Icon";

const NAV = [
  { label: "Examinations", href: "/admin/dashboard" },
  { label: "Courses", href: "/admin/courses" },
  { label: "My Profile", href: "/admin/profile" },
  { label: "Settings", href: "/admin/settings" },
];

interface TraineeDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  username: string | null;
  location: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  currentEmploymentStatus: string | null;
  openToWork: boolean;
  resumeUrl: string | null;
  createdAt: string;
  emailVerified: boolean;
  publiclyDiscoverable: boolean;
  suspended: boolean;
  availabilityTypes: string[];
  skills: { name: string; proficiency: string }[];
  education: { id: string; institution: string; fieldOfStudy: string | null; credential: string | null }[];
  workExperiences: { id: string; employerName: string; title: string }[];
  projects: { id: string; title: string; url: string | null }[];
  certificates: { code: string; issuedAt: string; revokedAt: string | null; course: { title: string } }[];
  badges: { threshold: number; awardedAt: string; course: { title: string } }[];
  courseEnrollments: { course: { title: string }; unlockedAt: string | null }[];
}

/**
 * Universal profile system, Phase 3 — an admin's read-only detail view
 * of one trainee's account and profile, for moderation/support
 * purposes. Deliberately read-only here: editing a trainee's own
 * profile content isn't an admin action this app grants (matches the
 * plan's "manage profile visibility / suspend" scope, not "impersonate
 * and rewrite someone's bio").
 */
export default function AdminTraineeDetailPage({ params }: { params: { id: string } }) {
  const [trainee, setTrainee] = useState<TraineeDetail | null>(null);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);

  function load() {
    setError(false);
    setNotFound(false);
    fetch(`/api/admin/trainees/${params.id}`)
      .then((r) => {
        if (r.status === 404) {
          setNotFound(true);
          return null;
        }
        return r.ok ? r.json() : Promise.reject();
      })
      .then((data) => data && setTrainee(data))
      .catch(() => setError(true));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (notFound) {
    return (
      <>
        <SiteHeader nav={NAV} right={<LogoutButton />} />
        <main className="mx-auto max-w-2xl px-6 py-10">
          <p className="text-sm text-gray-600">This trainee could not be found.</p>
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <SiteHeader nav={NAV} right={<LogoutButton />} />
        <main className="mx-auto max-w-2xl px-6 py-10">
          <ErrorState message="We couldn't load this trainee." onRetry={load} />
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <BackLink href="/admin/trainees">Back to Trainees</BackLink>

        {trainee === null ? (
          <div className="mt-4">
            <SkeletonList rows={4} />
          </div>
        ) : (
          <>
            <div className="mt-2 flex items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-semibold text-brand-ink">{trainee.name}</h1>
                <p className="text-sm text-gray-500">
                  {trainee.email}
                  {trainee.phone && ` · ${trainee.phone}`}
                </p>
                {trainee.username && <p className="text-xs text-gray-400">@{trainee.username}</p>}
              </div>
              <div className="flex flex-wrap justify-end gap-1.5">
                {!trainee.emailVerified && <Badge variant="warning">Unverified</Badge>}
                {trainee.publiclyDiscoverable && <Badge variant="success">Discoverable</Badge>}
                {trainee.openToWork && <Badge variant="success">Open to work</Badge>}
                {trainee.suspended && <Badge variant="danger">Q&amp;A Suspended</Badge>}
              </div>
            </div>

            <Card className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Profile</p>
              <div className="mt-2 space-y-1 text-sm text-gray-700">
                {trainee.location && (
                  <p className="flex items-center gap-1">
                    <Icon icon={MapPin} size="sm" /> {trainee.location}
                  </p>
                )}
                {trainee.currentEmploymentStatus && <p>Status: {trainee.currentEmploymentStatus}</p>}
                {trainee.availabilityTypes.length > 0 && <p>Open to: {trainee.availabilityTypes.join(", ")}</p>}
                <p className="flex flex-wrap gap-3 pt-1">
                  {trainee.linkedinUrl && (
                    <a href={trainee.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-brand-teal hover:underline">
                      LinkedIn
                    </a>
                  )}
                  {trainee.githubUrl && (
                    <a href={trainee.githubUrl} target="_blank" rel="noopener noreferrer" className="text-brand-teal hover:underline">
                      GitHub
                    </a>
                  )}
                  {trainee.portfolioUrl && (
                    <a href={trainee.portfolioUrl} target="_blank" rel="noopener noreferrer" className="text-brand-teal hover:underline">
                      Portfolio
                    </a>
                  )}
                  {trainee.resumeUrl && (
                    <a href={trainee.resumeUrl} target="_blank" rel="noopener noreferrer" className="text-brand-teal hover:underline">
                      Resume/CV
                    </a>
                  )}
                </p>
              </div>
            </Card>

            {trainee.skills.length > 0 && (
              <Card className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Skills</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {trainee.skills.map((s) => (
                    <li key={s.name} className="rounded-full bg-brand-mint px-2.5 py-1 text-xs font-medium text-brand-teal">
                      {s.name} · {s.proficiency.toLowerCase()}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {trainee.education.length > 0 && (
              <Card className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Education</p>
                <ul className="mt-2 space-y-1 text-sm text-brand-ink">
                  {trainee.education.map((e) => (
                    <li key={e.id}>
                      {e.institution}
                      {e.fieldOfStudy && ` — ${e.fieldOfStudy}`}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {trainee.workExperiences.length > 0 && (
              <Card className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Work Experience</p>
                <ul className="mt-2 space-y-1 text-sm text-brand-ink">
                  {trainee.workExperiences.map((e) => (
                    <li key={e.id}>
                      {e.title} · {e.employerName}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {trainee.certificates.length > 0 && (
              <Card className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Certificates</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {trainee.certificates.map((c) => (
                    <li
                      key={c.code}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        c.revokedAt ? "bg-brand-roseLight text-brand-rose" : "bg-brand-mint text-brand-teal"
                      }`}
                    >
                      {c.course.title} {c.revokedAt && "(revoked)"}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {trainee.courseEnrollments.length > 0 && (
              <Card className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Course Enrollments</p>
                <ul className="mt-2 space-y-1 text-sm text-brand-ink">
                  {trainee.courseEnrollments.map((e, i) => (
                    <li key={i}>
                      {e.course.title} {e.unlockedAt ? "" : "(pending unlock)"}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
      </main>
    </>
  );
}
