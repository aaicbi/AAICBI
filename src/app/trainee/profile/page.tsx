"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import Toggle from "@/components/ui/Toggle";
import AvatarFallback from "@/components/ui/AvatarFallback";
import { X } from "lucide-react";
import Icon from "@/components/ui/Icon";
import ProfileCompletionBanner from "@/components/ui/ProfileCompletionBanner";
import { computeTraineeCompletion } from "@/lib/profileCompletion";
import ResumeUpload from "@/components/ResumeUpload";

const NAV = [
  { label: "Dashboard", href: "/trainee/dashboard" },
  { label: "Courses", href: "/trainee/courses" },
  { label: "Introductions", href: "/trainee/introductions" },
  { label: "Job Board", href: "/trainee/job-postings" },
  { label: "Ask Loop", href: "/trainee/buddy" },
  { label: "Messages", href: "/trainee/messages" },
  { label: "My Profile", href: "/trainee/profile" },
  { label: "Settings", href: "/trainee/settings" },
];

const EMPLOYMENT_STATUS_LABELS: Record<string, string> = {
  STUDENT: "Student",
  EMPLOYED: "Employed",
  UNEMPLOYED: "Unemployed",
  SELF_EMPLOYED: "Self-employed",
};

const AVAILABILITY_LABELS: Record<string, string> = {
  INTERNSHIP: "Internship",
  FREELANCE: "Freelance",
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
};

const VISIBILITY_LABELS: Record<string, string> = {
  PUBLIC: "Public — anyone, no sign-in required",
  AUTHENTICATED: "Any signed-in AAICBI account",
  EMPLOYERS_ONLY: "Approved employers only",
  PRIVATE: "Private — only you and admins",
};

interface ProfileCore {
  name: string;
  avatarUrl: string | null;
  username: string | null;
  location: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  currentEmploymentStatus: string | null;
  openToWork: boolean;
  profileVisibility: string;
  resumeUrl: string | null;
  availabilityTypes: string[];
}

interface SkillItem {
  id: string;
  skillId: string;
  name: string;
  category: string | null;
  proficiency: string;
}

interface EducationItem {
  id: string;
  institution: string;
  credential: string | null;
  fieldOfStudy: string | null;
  startDate: string | null;
  endDate: string | null;
  current: boolean;
}

interface ExperienceItem {
  id: string;
  employerName: string;
  title: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  current: boolean;
}

interface ProjectItem {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
}

/**
 * Universal profile system, Phase 1 — the trainee's own, richer,
 * authenticated profile-editing page. Deliberately separate from
 * /trainee/settings: that page owns account preferences (notifications,
 * language, dark mode) and the M32 employer-discoverability toggle;
 * this page owns the profile CONTENT those settings gate visibility
 * for. Each section below is its own small, independently-saved unit —
 * same pattern /trainee/settings already uses for its Employer
 * Discoverability card — rather than one giant form.
 */
export default function TraineeProfilePage() {
  const { showToast } = useToast();
  const [loadError, setLoadError] = useState(false);

  const [core, setCore] = useState<ProfileCore | null>(null);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [coreForm, setCoreForm] = useState({
    username: "",
    location: "",
    linkedinUrl: "",
    githubUrl: "",
    portfolioUrl: "",
    currentEmploymentStatus: "",
    openToWork: false,
    profileVisibility: "PRIVATE",
    availabilityTypes: [] as string[],
  });
  const [savingCore, setSavingCore] = useState(false);

  const [skills, setSkills] = useState<SkillItem[] | null>(null);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillProficiency, setNewSkillProficiency] = useState("INTERMEDIATE");
  const [addingSkill, setAddingSkill] = useState(false);

  const [education, setEducation] = useState<EducationItem[] | null>(null);
  const [experience, setExperience] = useState<ExperienceItem[] | null>(null);
  const [projects, setProjects] = useState<ProjectItem[] | null>(null);

  function load() {
    setLoadError(false);
    setCore(null);
    setSkills(null);
    setEducation(null);
    setExperience(null);
    setProjects(null);
    Promise.all([
      fetch("/api/trainee/profile").then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch("/api/trainee/skills").then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch("/api/trainee/education").then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch("/api/trainee/experience").then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch("/api/trainee/projects").then((r) => (r.ok ? r.json() : Promise.reject())),
    ])
      .then(([coreData, skillsData, educationData, experienceData, projectsData]) => {
        setCore(coreData);
        setResumeUrl(coreData.resumeUrl);
        setCoreForm({
          username: coreData.username ?? "",
          location: coreData.location ?? "",
          linkedinUrl: coreData.linkedinUrl ?? "",
          githubUrl: coreData.githubUrl ?? "",
          portfolioUrl: coreData.portfolioUrl ?? "",
          currentEmploymentStatus: coreData.currentEmploymentStatus ?? "",
          openToWork: coreData.openToWork,
          profileVisibility: coreData.profileVisibility,
          availabilityTypes: coreData.availabilityTypes,
        });
        setSkills(skillsData);
        setEducation(educationData);
        setExperience(experienceData);
        setProjects(projectsData);
      })
      .catch(() => setLoadError(true));
  }

  useEffect(() => {
    load();
  }, []);

  function toggleAvailability(type: string) {
    setCoreForm((f) => ({
      ...f,
      availabilityTypes: f.availabilityTypes.includes(type)
        ? f.availabilityTypes.filter((t) => t !== type)
        : [...f.availabilityTypes, type],
    }));
  }

  async function saveCore() {
    setSavingCore(true);
    const res = await fetch("/api/trainee/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: coreForm.username,
        location: coreForm.location,
        linkedinUrl: coreForm.linkedinUrl,
        githubUrl: coreForm.githubUrl,
        portfolioUrl: coreForm.portfolioUrl,
        currentEmploymentStatus: coreForm.currentEmploymentStatus || null,
        openToWork: coreForm.openToWork,
        profileVisibility: coreForm.profileVisibility,
        availabilityTypes: coreForm.availabilityTypes,
      }),
    });
    setSavingCore(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not save. Try again.", "error");
      return;
    }
    showToast("Saved.");
    load();
  }

  async function addSkill() {
    if (!newSkillName.trim()) return;
    setAddingSkill(true);
    const res = await fetch("/api/trainee/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSkillName.trim(), proficiency: newSkillProficiency }),
    });
    setAddingSkill(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not add skill.", "error");
      return;
    }
    const created = await res.json();
    setSkills((prev) => (prev ? [...prev, created].sort((a, b) => a.name.localeCompare(b.name)) : [created]));
    setNewSkillName("");
    setNewSkillProficiency("INTERMEDIATE");
  }

  async function removeSkill(id: string) {
    setSkills((prev) => prev?.filter((s) => s.id !== id) ?? null);
    const res = await fetch(`/api/trainee/skills/${id}`, { method: "DELETE" });
    if (!res.ok) {
      showToast("Could not remove skill.", "error");
      load();
    }
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
            {core?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={core.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <AvatarFallback size="lg" />
              </div>
            )}
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold text-brand-ink">{core?.name ?? "My Profile"}</h1>
            <p className="text-sm text-gray-500">
              {core?.username ? `@${core.username}` : "No username set yet"}
              {core?.openToWork && (
                <>
                  {" · "}
                  <Badge variant="success">Open to work</Badge>
                </>
              )}
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Change your profile picture from <a href="/trainee/settings" className="underline">Settings</a>.
        </p>

        {core === null ? (
          <div className="mt-6">
            <SkeletonList rows={4} />
          </div>
        ) : (
          <>
            {skills !== null && education !== null && experience !== null && projects !== null && (
              <ProfileCompletionBanner
                {...computeTraineeCompletion({
                  avatarUrl: core.avatarUrl,
                  username: core.username,
                  location: core.location,
                  linkedinUrl: core.linkedinUrl,
                  githubUrl: core.githubUrl,
                  portfolioUrl: core.portfolioUrl,
                  currentEmploymentStatus: core.currentEmploymentStatus,
                  resumeUrl,
                  skillCount: skills.length,
                  educationCount: education.length,
                  experienceOrProjectCount: experience.length + projects.length,
                })}
              />
            )}

            {/* Basic Info */}
            <Card className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Basic Info</p>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-sm font-semibold text-brand-ink">Username</label>
                  <input
                    value={coreForm.username}
                    onChange={(e) => setCoreForm((f) => ({ ...f, username: e.target.value }))}
                    placeholder="e.g. ada-lovelace"
                    className="mt-1 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-brand-ink">Location</label>
                  <input
                    value={coreForm.location}
                    onChange={(e) => setCoreForm((f) => ({ ...f, location: e.target.value }))}
                    placeholder="e.g. Lagos, Nigeria"
                    className="mt-1 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-brand-ink">LinkedIn</label>
                  <input
                    value={coreForm.linkedinUrl}
                    onChange={(e) => setCoreForm((f) => ({ ...f, linkedinUrl: e.target.value }))}
                    placeholder="https://linkedin.com/in/..."
                    className="mt-1 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-brand-ink">GitHub</label>
                  <input
                    value={coreForm.githubUrl}
                    onChange={(e) => setCoreForm((f) => ({ ...f, githubUrl: e.target.value }))}
                    placeholder="https://github.com/..."
                    className="mt-1 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-brand-ink">Portfolio website</label>
                  <input
                    value={coreForm.portfolioUrl}
                    onChange={(e) => setCoreForm((f) => ({ ...f, portfolioUrl: e.target.value }))}
                    placeholder="https://..."
                    className="mt-1 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
                  />
                </div>
              </div>
            </Card>

            {/* Employment & Availability */}
            <Card className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Employment &amp; Availability</p>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-sm font-semibold text-brand-ink">Current employment status</label>
                  <select
                    value={coreForm.currentEmploymentStatus}
                    onChange={(e) => setCoreForm((f) => ({ ...f, currentEmploymentStatus: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
                  >
                    <option value="">Prefer not to say</option>
                    {Object.entries(EMPLOYMENT_STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-brand-ink">Open to work</span>
                  <Toggle
                    checked={coreForm.openToWork}
                    onChange={(next) => setCoreForm((f) => ({ ...f, openToWork: next }))}
                    label="Open to work"
                  />
                </div>
                {coreForm.openToWork && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600">Open to</p>
                    <div className="mt-1 space-y-1">
                      {Object.entries(AVAILABILITY_LABELS).map(([value, label]) => (
                        <label key={value} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={coreForm.availabilityTypes.includes(value)}
                            onChange={() => toggleAvailability(value)}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4">
                <Button size="sm" onClick={saveCore} loading={savingCore}>
                  Save
                </Button>
              </div>
            </Card>

            {/* Profile Visibility */}
            <Card className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Profile Visibility</p>
              <p className="mt-1 text-xs text-gray-500">
                Who can view your Skills, Education, Experience, Projects, and Achievements below at{" "}
                {core?.username ? (
                  <a href={`/profile/u/${core.username}`} className="text-brand-teal hover:underline" target="_blank" rel="noopener noreferrer">
                    /profile/u/{core.username}
                  </a>
                ) : (
                  "your profile link (set a username above first)"
                )}
                . This is separate from the Employer Discoverability setting in Settings.
              </p>
              <select
                value={coreForm.profileVisibility}
                onChange={(e) => setCoreForm((f) => ({ ...f, profileVisibility: e.target.value }))}
                className="mt-2 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
              >
                {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <div className="mt-3">
                <Button size="sm" onClick={saveCore} loading={savingCore}>
                  Save
                </Button>
              </div>
            </Card>

            {/* Resume/CV */}
            <Card className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Resume/CV</p>
              <div className="mt-3">
                <ResumeUpload resumeUrl={resumeUrl} onChange={setResumeUrl} />
              </div>
            </Card>

            {/* Skills */}
            <Card className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Skills</p>
              {skills === null ? (
                <div className="mt-3">
                  <SkeletonList rows={1} />
                </div>
              ) : skills.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">No skills added yet.</p>
              ) : (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {skills.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center gap-1.5 rounded-full bg-brand-mint px-3 py-1 text-xs font-medium text-brand-teal"
                    >
                      {s.name}
                      <span className="text-brand-tealDeep/70">· {s.proficiency.toLowerCase()}</span>
                      <button
                        onClick={() => removeSkill(s.id)}
                        aria-label={`Remove ${s.name}`}
                        className="text-brand-teal hover:text-brand-rose"
                      >
                        <Icon icon={X} size="sm" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  placeholder="Add a skill, e.g. Python"
                  className="min-w-0 flex-1 rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
                />
                <select
                  value={newSkillProficiency}
                  onChange={(e) => setNewSkillProficiency(e.target.value)}
                  className="rounded-lg border border-brand-gray px-2 py-2 text-sm outline-none focus:border-brand-teal"
                >
                  <option value="BEGINNER">Beginner</option>
                  <option value="INTERMEDIATE">Intermediate</option>
                  <option value="ADVANCED">Advanced</option>
                  <option value="EXPERT">Expert</option>
                </select>
                <Button size="sm" onClick={addSkill} loading={addingSkill}>
                  Add
                </Button>
              </div>
            </Card>

            <EducationSection education={education} onChange={setEducation} showToast={showToast} />
            <ExperienceSection experience={experience} onChange={setExperience} showToast={showToast} />
            <ProjectsSection projects={projects} onChange={setProjects} showToast={showToast} />
          </>
        )}
      </main>
    </>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short" });
}

function EducationSection({
  education,
  onChange,
  showToast,
}: {
  education: EducationItem[] | null;
  onChange: (v: EducationItem[]) => void;
  showToast: (msg: string, variant?: "success" | "error" | "info") => void;
}) {
  const [form, setForm] = useState({ institution: "", credential: "", fieldOfStudy: "", startDate: "", endDate: "", current: false });
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!form.institution.trim()) return;
    setSaving(true);
    const res = await fetch("/api/trainee/education", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : "",
        endDate: form.endDate ? new Date(form.endDate).toISOString() : "",
      }),
    });
    setSaving(false);
    if (!res.ok) {
      showToast("Could not add education entry.", "error");
      return;
    }
    const created = await res.json();
    onChange([...(education ?? []), created]);
    setForm({ institution: "", credential: "", fieldOfStudy: "", startDate: "", endDate: "", current: false });
  }

  async function remove(id: string) {
    onChange((education ?? []).filter((e) => e.id !== id));
    const res = await fetch(`/api/trainee/education/${id}`, { method: "DELETE" });
    if (!res.ok) showToast("Could not remove entry.", "error");
  }

  return (
    <Card className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Education</p>
      {education === null ? (
        <SkeletonList rows={1} />
      ) : education.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">No education added yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {education.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-2 border-b border-brand-gray pb-2 last:border-0">
              <div>
                <p className="text-sm font-semibold text-brand-ink">{e.institution}</p>
                {e.fieldOfStudy && <p className="text-xs text-gray-600">{e.fieldOfStudy}</p>}
                {e.credential && <p className="text-xs text-gray-600">{e.credential}</p>}
                <p className="text-xs text-gray-400">
                  {fmtDate(e.startDate) ?? "—"} – {e.current ? "Present" : fmtDate(e.endDate) ?? "—"}
                </p>
              </div>
              <button onClick={() => remove(e.id)} className="text-xs font-semibold text-brand-rose">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 space-y-2 border-t border-brand-gray pt-3">
        <input
          value={form.institution}
          onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))}
          placeholder="Institution"
          className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
        />
        <input
          value={form.fieldOfStudy}
          onChange={(e) => setForm((f) => ({ ...f, fieldOfStudy: e.target.value }))}
          placeholder="Field of study (optional)"
          className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
        />
        <input
          value={form.credential}
          onChange={(e) => setForm((f) => ({ ...f, credential: e.target.value }))}
          placeholder="Credential, e.g. B.Sc. Computer Science (optional)"
          className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            className="rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
          />
          <span className="text-xs text-gray-500">to</span>
          <input
            type="date"
            value={form.endDate}
            disabled={form.current}
            onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            className="rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal disabled:opacity-50"
          />
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={form.current} onChange={(e) => setForm((f) => ({ ...f, current: e.target.checked }))} />
            Currently studying here
          </label>
        </div>
        <Button size="sm" onClick={add} loading={saving}>
          Add Education
        </Button>
      </div>
    </Card>
  );
}

function ExperienceSection({
  experience,
  onChange,
  showToast,
}: {
  experience: ExperienceItem[] | null;
  onChange: (v: ExperienceItem[]) => void;
  showToast: (msg: string, variant?: "success" | "error" | "info") => void;
}) {
  const [form, setForm] = useState({ employerName: "", title: "", description: "", startDate: "", endDate: "", current: false });
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!form.employerName.trim() || !form.title.trim()) return;
    setSaving(true);
    const res = await fetch("/api/trainee/experience", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : "",
        endDate: form.endDate ? new Date(form.endDate).toISOString() : "",
      }),
    });
    setSaving(false);
    if (!res.ok) {
      showToast("Could not add work experience.", "error");
      return;
    }
    const created = await res.json();
    onChange([...(experience ?? []), created]);
    setForm({ employerName: "", title: "", description: "", startDate: "", endDate: "", current: false });
  }

  async function remove(id: string) {
    onChange((experience ?? []).filter((e) => e.id !== id));
    const res = await fetch(`/api/trainee/experience/${id}`, { method: "DELETE" });
    if (!res.ok) showToast("Could not remove entry.", "error");
  }

  return (
    <Card className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Work Experience</p>
      {experience === null ? (
        <SkeletonList rows={1} />
      ) : experience.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">No work experience added yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {experience.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-2 border-b border-brand-gray pb-2 last:border-0">
              <div>
                <p className="text-sm font-semibold text-brand-ink">
                  {e.title} · {e.employerName}
                </p>
                {e.description && <p className="text-xs text-gray-600">{e.description}</p>}
                <p className="text-xs text-gray-400">
                  {fmtDate(e.startDate) ?? "—"} – {e.current ? "Present" : fmtDate(e.endDate) ?? "—"}
                </p>
              </div>
              <button onClick={() => remove(e.id)} className="text-xs font-semibold text-brand-rose">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 space-y-2 border-t border-brand-gray pt-3">
        <input
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="Job title"
          className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
        />
        <input
          value={form.employerName}
          onChange={(e) => setForm((f) => ({ ...f, employerName: e.target.value }))}
          placeholder="Employer"
          className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
        />
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Description (optional)"
          rows={2}
          className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            className="rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
          />
          <span className="text-xs text-gray-500">to</span>
          <input
            type="date"
            value={form.endDate}
            disabled={form.current}
            onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            className="rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal disabled:opacity-50"
          />
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={form.current} onChange={(e) => setForm((f) => ({ ...f, current: e.target.checked }))} />
            Current role
          </label>
        </div>
        <Button size="sm" onClick={add} loading={saving}>
          Add Experience
        </Button>
      </div>
    </Card>
  );
}

function ProjectsSection({
  projects,
  onChange,
  showToast,
}: {
  projects: ProjectItem[] | null;
  onChange: (v: ProjectItem[]) => void;
  showToast: (msg: string, variant?: "success" | "error" | "info") => void;
}) {
  const [form, setForm] = useState({ title: "", description: "", url: "" });
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!form.title.trim()) return;
    setSaving(true);
    const res = await fetch("/api/trainee/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not add project.", "error");
      return;
    }
    const created = await res.json();
    onChange([...(projects ?? []), created]);
    setForm({ title: "", description: "", url: "" });
  }

  async function remove(id: string) {
    onChange((projects ?? []).filter((p) => p.id !== id));
    const res = await fetch(`/api/trainee/projects/${id}`, { method: "DELETE" });
    if (!res.ok) showToast("Could not remove project.", "error");
  }

  return (
    <Card className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Projects</p>
      {projects === null ? (
        <SkeletonList rows={1} />
      ) : projects.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">No projects added yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {projects.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-2 border-b border-brand-gray pb-2 last:border-0">
              <div>
                <p className="text-sm font-semibold text-brand-ink">
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-brand-teal hover:underline">
                      {p.title}
                    </a>
                  ) : (
                    p.title
                  )}
                </p>
                {p.description && <p className="text-xs text-gray-600">{p.description}</p>}
              </div>
              <button onClick={() => remove(p.id)} className="text-xs font-semibold text-brand-rose">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 space-y-2 border-t border-brand-gray pt-3">
        <input
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="Project title"
          className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
        />
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Description (optional)"
          rows={2}
          className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
        />
        <input
          value={form.url}
          onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
          placeholder="Link (optional)"
          className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
        />
        <Button size="sm" onClick={add} loading={saving}>
          Add Project
        </Button>
      </div>
    </Card>
  );
}
