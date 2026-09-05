"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";
import LockedDoodle from "@/components/doodles/LockedDoodle";
import AchievementDoodle from "@/components/doodles/AchievementDoodle";
import { extractYouTubeId, extractGoogleDriveFileId } from "@/lib/materialUrl";
import { useToast } from "@/components/ui/Toast";

interface MaterialDto {
  id: string;
  type: "PDF" | "DOCX" | "PPTX" | "VIDEO";
  title: string;
  url: string;
}
interface LessonDto {
  id: string;
  title: string;
  description: string | null;
  materials: MaterialDto[];
  completedByMe: boolean;
}
interface ModuleDto {
  id: string;
  title: string;
  description: string | null;
  lessons: LessonDto[];
  unlocked: boolean;
  completed: boolean;
}

interface AssessmentMetaDto {
  totalQuestions: number;
  passMarkPercent: number;
  maxAttempts: number | null;
}
interface AttemptSummary {
  passed: boolean | null;
  percentage: number | null;
}

/**
 * M11 — a small "Assessment" strip inside each module's expanded
 * section. Two independent fetches per module (assessment meta +
 * attempt history), both of which 404/return-empty harmlessly for a
 * module that doesn't have a published assessment yet.
 *
 * M12: only ever rendered for an unlocked module now (see the parent
 * component) — a locked module's assessment isn't reachable, so there
 * was nothing to gate here directly; the gate lives one level up.
 */
function ModuleAssessmentStrip({ courseId, moduleId }: { courseId: string; moduleId: string }) {
  const [meta, setMeta] = useState<AssessmentMetaDto | null | "none">(null);
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/modules/${moduleId}/assessment`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        setMeta(data ?? "none");
      })
      .catch(() => !cancelled && setMeta("none"));
    fetch(`/api/modules/${moduleId}/attempts`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => !cancelled && data && setAttempts(data.attempts))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [moduleId]);

  if (meta === null) return null; // still loading — don't flash a "no assessment" state
  if (meta === "none") return null; // no published assessment for this module yet

  const best = attempts.reduce<AttemptSummary | null>((acc, a) => {
    if (a.percentage === null) return acc;
    if (!acc || (a.percentage ?? 0) > (acc.percentage ?? 0)) return a;
    return acc;
  }, null);
  const attemptsExhausted = meta.maxAttempts !== null && attempts.length >= meta.maxAttempts;

  return (
    <Card className="flex flex-col items-start gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-xs text-gray-600">
        <span className="font-semibold text-brand-ink">Assessment</span> — {meta.totalQuestions} question
        {meta.totalQuestions === 1 ? "" : "s"}, pass mark {meta.passMarkPercent}%
        {best && (
          <span className={`ml-2 font-semibold ${best.passed ? "text-brand-teal" : "text-brand-gold"}`}>
            · Best: {Math.round(best.percentage ?? 0)}% {best.passed ? "(Passed)" : ""}
          </span>
        )}
      </div>
      {attemptsExhausted ? (
        <Badge variant="danger">No attempts remaining</Badge>
      ) : (
        <Button href={`/trainee/courses/${courseId}/modules/${moduleId}/assessment`} size="sm">
          {attempts.length > 0 ? "Retake Assessment" : "Take Assessment"}
        </Button>
      )}
    </Card>
  );
}
interface CertificateDto {
  code: string;
  issuedAt: string;
}
interface BadgeDto {
  threshold: number;
  awardedAt: string;
}
interface CourseDto {
  id: string;
  title: string;
  description: string | null;
  createdBy: { name: string };
  modules: ModuleDto[];
  certificate: CertificateDto | null;
  badges: BadgeDto[];
  hasPublishedExamination: boolean;
  allModulesComplete: boolean;
}

const MATERIAL_ICON: Record<MaterialDto["type"], string> = {
  PDF: "📄",
  DOCX: "📝",
  PPTX: "📊",
  VIDEO: "🎬",
};

/**
 * M10 audit finding #2: video materials were rendering as a plain
 * outbound <a target="_blank"> straight to youtube.com — which
 * quietly broke the access-control reasoning the roadmap documented
 * ("access control happens at the lesson page because the video is
 * embedded inside it"). A bare link puts the raw URL directly in the
 * trainee's address bar, trivially copyable, with the authenticated
 * page providing zero further protection once they've clicked through.
 * This embeds the video in an iframe on the authenticated page instead,
 * matching what was actually documented. Falls back to a plain link
 * only if the URL doesn't match a recognised YouTube shape — never
 * silently show a broken embed.
 */
/**
 * Click-to-play thumbnail, not the player loading immediately —
 * closer to how a shared YouTube link actually behaves in a chat app,
 * and it means a trainee just skimming a lesson doesn't have YouTube's
 * player chrome loading in the background for every video on the page
 * whether they intend to watch it or not. Genuinely complementary to
 * M39's low-bandwidth mode, not overlapping with it — this is about
 * *when* the embed loads, M39 is about lesson content in general.
 *
 * The thumbnail itself (img.youtube.com) is a plain static image
 * request — meaningfully lower tracking surface than loading the full
 * player, which is exactly why "click to load" patterns use a
 * thumbnail rather than a paused, already-loaded iframe. The actual
 * player still only ever loads from youtube-nocookie.com, unchanged
 * from before, and only once the trainee has actually chosen to watch.
 */
function YouTubeThumbnailPlayer({ videoId, title, lowBandwidthMode }: { videoId: string; title: string; lowBandwidthMode: boolean }) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
        title={title}
        className="h-full w-full"
        allow="accelerated-video; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    );
  }

  // M39 — in low-bandwidth mode, don't even fetch the thumbnail image
  // (img.youtube.com) until the trainee has actually chosen to play —
  // a genuine, if small, network request saved on top of the iframe
  // itself already never auto-loading for anyone. A plain icon and
  // label instead, same tap target, same result once tapped.
  if (lowBandwidthMode) {
    return (
      <button
        type="button"
        onClick={() => setPlaying(true)}
        aria-label={`Play video: ${title}`}
        className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#111827] text-white/80 transition-colors hover:bg-[#1f2937]"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-10 w-10">
          <path d="M8 5v14l11-7z" />
        </svg>
        <span className="text-xs">Tap to load video</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play video: ${title}`}
      className="group relative h-full w-full cursor-pointer overflow-hidden bg-black"
    >
      <img
        src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
        alt=""
        className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-70"
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60 text-white transition-transform group-hover:scale-110">
          <svg viewBox="0 0 24 24" fill="currentColor" className="ml-1 h-6 w-6">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
    </button>
  );
}

/**
 * The Drive counterpart to YouTubeThumbnailPlayer right above — same
 * shape and behavior deliberately, not a different UI pattern: a
 * thumbnail with a play overlay, click-to-play swaps in a real
 * embedded player, and the same low-bandwidth skip-the-thumbnail
 * treatment. Two real differences from the YouTube version, both
 * because Drive genuinely isn't built to be a video host the way
 * YouTube is — confirmed directly before building this, not assumed:
 * the thumbnail only renders if the file's sharing is set to "Anyone
 * with the link" (a real admin-side requirement, not something this
 * app can control), so `onError` falls back to a plain placeholder
 * rather than a broken image icon; and Drive enforces its own
 * playback quotas on heavily-viewed files, a real, occasional-failure
 * risk YouTube doesn't have at this app's likely scale.
 */
function GoogleDriveThumbnailPlayer({ fileId, title, lowBandwidthMode }: { fileId: string; title: string; lowBandwidthMode: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  if (playing) {
    return (
      <iframe
        src={`https://drive.google.com/file/d/${fileId}/preview`}
        title={title}
        className="h-full w-full"
        allow="autoplay"
        allowFullScreen
      />
    );
  }

  if (lowBandwidthMode || thumbnailFailed) {
    return (
      <button
        type="button"
        onClick={() => setPlaying(true)}
        aria-label={`Play video: ${title}`}
        className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#111827] text-white/80 transition-colors hover:bg-[#1f2937]"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-10 w-10">
          <path d="M8 5v14l11-7z" />
        </svg>
        <span className="text-xs">{thumbnailFailed ? "Tap to play video" : "Tap to load video"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play video: ${title}`}
      className="group relative h-full w-full cursor-pointer overflow-hidden bg-black"
    >
      <img
        src={`https://drive.google.com/thumbnail?id=${fileId}`}
        alt=""
        onError={() => setThumbnailFailed(true)}
        className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-70"
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60 text-white transition-transform group-hover:scale-110">
          <svg viewBox="0 0 24 24" fill="currentColor" className="ml-1 h-6 w-6">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
    </button>
  );
}

/**
 * M40 — the real download trigger, shown alongside every material
 * type, not just the plain-link fallback. A real client-side handler,
 * not a plain `<a href>` — the download route can genuinely fail (not
 * enrolled, module locked, or the one honest limitation this whole
 * milestone has to live with: a source that isn't actually
 * downloadable, most plausibly a YouTube-hosted video), and those come
 * back as a JSON error, not a file. A plain link would show the
 * trainee a raw JSON blob in their browser for any of those; this
 * shows a clear, readable message instead.
 */
function DownloadButton({ materialId, title }: { materialId: string; title: string }) {
  const [state, setState] = useState<"idle" | "downloading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setState("downloading");
    setError(null);
    const res = await fetch(`/api/materials/${materialId}/download`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not download this material.");
      setState("error");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = title;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setState("idle");
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleDownload}
        disabled={state === "downloading"}
        className="text-xs font-medium text-brand-teal hover:underline disabled:opacity-60"
      >
        {state === "downloading" ? "Downloading..." : "⬇ Download for offline"}
      </button>
      {state === "error" && error && <p className="mt-0.5 text-xs text-brand-rose">{error}</p>}
    </div>
  );
}

function MaterialItem({ material, lowBandwidthMode }: { material: MaterialDto; lowBandwidthMode: boolean }) {
  if (material.type === "VIDEO") {
    const videoId = extractYouTubeId(material.url);
    if (videoId) {
      return (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-sm font-medium text-brand-ink">
            {MATERIAL_ICON.VIDEO} {material.title}
          </p>
          <div className="aspect-video w-full overflow-hidden rounded-lg border border-brand-gray bg-black">
            <YouTubeThumbnailPlayer videoId={videoId} title={material.title} lowBandwidthMode={lowBandwidthMode} />
          </div>
          <DownloadButton materialId={material.id} title={material.title} />
        </div>
      );
    }
    // M40 — the Drive counterpart to the YouTube check right above,
    // same reasoning: only rendered when the URL genuinely resolves to
    // a Drive file ID, never a guess.
    const driveFileId = extractGoogleDriveFileId(material.url);
    if (driveFileId) {
      return (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-sm font-medium text-brand-ink">
            {MATERIAL_ICON.VIDEO} {material.title}
          </p>
          <div className="aspect-video w-full overflow-hidden rounded-lg border border-brand-gray bg-black">
            <GoogleDriveThumbnailPlayer fileId={driveFileId} title={material.title} lowBandwidthMode={lowBandwidthMode} />
          </div>
          <DownloadButton materialId={material.id} title={material.title} />
        </div>
      );
    }
    // Recognised as a VIDEO material but the URL didn't match a known
    // YouTube or Drive shape — this shouldn't happen for anything
    // created after the audit fix (the API now rejects URLs that
    // aren't one or the other for VIDEO materials), but could still
    // apply to data saved before that fix. Fall back to a plain link
    // rather than show a broken embed.
  }

  return (
    <div className="space-y-0.5">
      <a
        href={material.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-sm text-brand-teal hover:underline"
      >
        {MATERIAL_ICON[material.type]} {material.title}
      </a>
      <DownloadButton materialId={material.id} title={material.title} />
    </div>
  );
}

/** M12 — the "Mark complete" toggle per lesson. Optimistic UI (flips
 * immediately, reverts on a failed request) since this is a low-stakes
 * action a trainee will click often while working through a course. */
function LessonCompleteToggle({
  lessonId,
  completed,
  onChanged,
}: {
  lessonId: string;
  completed: boolean;
  onChanged: (completed: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !completed;
    onChanged(next); // optimistic
    setSaving(true);
    const res = await fetch(`/api/lessons/${lessonId}/progress`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: next }),
    });
    setSaving(false);
    if (!res.ok) onChanged(!next); // revert on failure
  }

  return (
    <button
      onClick={toggle}
      disabled={saving}
      className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
        completed
          ? "border-brand-teal bg-brand-mint text-brand-teal"
          : "border-brand-gray text-gray-600 hover:border-brand-teal hover:text-brand-teal"
      }`}
    >
      {completed ? "✓ Completed" : "Mark Complete"}
    </button>
  );
}

/**
 * M12: module locking layered on top of M10's browse view. A locked
 * module's title stays visible (so a trainee can see what's coming)
 * but its lessons/materials never render — the server already
 * redacted them (see GET /api/courses/[id]'s trainee branch), this is
 * just the corresponding empty-state message, not the enforcement
 * itself.
 *
 * Design-pass update: this was the last major trainee-facing page
 * still on the pre-redesign styling despite being where a trainee
 * spends the most time in the whole app. Certificate banner switched
 * from teal to the gold "celebratory" treatment — it was inconsistent
 * with the rest of this redesign's own rule (gold reserved for genuine
 * achievement, see Card.tsx) to have earning a certificate look
 * identical to an ordinary informational callout. Locked modules now
 * use LockedDoodle instead of a bare 🔒 emoji — deliberately calm and
 * teal/gray rather than alarming, matching that doodle's own stated
 * purpose ("not yet," not a failure state).
 */
interface NotEnrolledCourseDto {
  id: string;
  title: string;
  description: string | null;
  isFree: boolean;
  priceKobo: number | null;
  billingInterval: "MONTHLY" | "QUARTERLY" | "ANNUALLY" | null;
}

export default function TraineeCourseViewPage({ params }: { params: { id: string } }) {
  const [course, setCourse] = useState<CourseDto | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [notEnrolled, setNotEnrolled] = useState<NotEnrolledCourseDto | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [openModule, setOpenModule] = useState<string | null>(null);

  function loadCourse() {
    fetch(`/api/courses/${params.id}`)
      .then(async (r) => {
        if (r.status === 403) {
          // M18/M19 — a real, distinct state from "not found": the
          // course exists and is browsable, the trainee just isn't
          // enrolled yet. Shows an actual enroll prompt with the
          // course's basic info, not a generic 404.
          const data = await r.json().catch(() => null);
          setNotEnrolled(data?.course ?? null);
          return;
        }
        if (!r.ok) {
          setNotFound(true);
          return;
        }
        const data = await r.json();
        setCourse(data);
        setNotEnrolled(null);
        setOpenModule((current) => current ?? data.modules[0]?.id ?? null);
      })
      .catch(() => setNotFound(true));
  }

  async function enroll() {
    setEnrolling(true);
    setEnrollError(null);
    const res = await fetch(`/api/courses/${params.id}/enroll`, { method: "POST" });
    setEnrolling(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setEnrollError(typeof data.error === "string" ? data.error : "Could not enroll. Try again.");
      return;
    }
    loadCourse(); // re-fetch — this time it should come back as a full, enrolled response
  }

  async function pay() {
    setEnrolling(true);
    setEnrollError(null);
    const res = await fetch(`/api/courses/${params.id}/pay`, { method: "POST" });
    setEnrolling(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setEnrollError(typeof data.error === "string" ? data.error : "Could not start payment. Try again.");
      return;
    }
    const data = await res.json();
    // A real, full-page navigation to Paystack's own hosted checkout —
    // not a fetch the app stays in control of. This is the one moment
    // it deliberately hands off entirely.
    window.location.href = data.authorizationUrl;
  }

  useEffect(() => {
    loadCourse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  // M39 — fetched once here, at the top of the page, and threaded down
  // to every MaterialItem/YouTubeThumbnailPlayer as a plain prop rather
  // than each video re-fetching this setting independently. Defaults
  // to false (the existing, already-built thumbnail behavior) until
  // the real value loads, so there's no flash of the wrong mode.
  const [lowBandwidthMode, setLowBandwidthMode] = useState(false);
  useEffect(() => {
    fetch("/api/trainee/settings")
      .then((r) => r.json())
      .then((data) => setLowBandwidthMode(!!data.lowBandwidthMode))
      .catch(() => {});
  }, []);

  function setLessonCompleted(moduleId: string, lessonId: string, completed: boolean) {
    setCourse((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        modules: prev.modules.map((m) =>
          m.id !== moduleId
            ? m
            : { ...m, lessons: m.lessons.map((l) => (l.id === lessonId ? { ...l, completedByMe: completed } : l)) }
        ),
      };
    });
  }

  const nav = [
    { label: "Dashboard", href: "/trainee/dashboard" },
    { label: "Courses", href: "/trainee/courses" },
    { label: "My Downloads", href: "/trainee/downloads" },
    { label: "Introductions", href: "/trainee/introductions" },
    { label: "Job Board", href: "/trainee/job-postings" },
    { label: "Settings", href: "/trainee/settings" },
  ];

  if (notFound) {
    return (
      <>
        <SiteHeader nav={nav} right={<LogoutButton />} />
        <main className="mx-auto max-w-2xl px-6 py-10 text-center text-gray-600">
          Course not found, or it isn&apos;t published yet.
        </main>
      </>
    );
  }
  if (notEnrolled) {
    return (
      <>
        <SiteHeader nav={nav} right={<LogoutButton />} />
        <main className="mx-auto max-w-2xl px-6 py-10">
          <Card>
            <h1 className="font-display text-xl font-semibold text-brand-ink">{notEnrolled.title}</h1>
            {notEnrolled.description && <p className="mt-2 text-sm text-gray-600">{notEnrolled.description}</p>}
            <p className="mt-4 text-sm text-gray-600">
              You&apos;re not enrolled in this course yet.
              {notEnrolled.isFree
                ? " It's free — enroll below to get started."
                : ` ₦${((notEnrolled.priceKobo ?? 0) / 100).toLocaleString()} / ${
                    notEnrolled.billingInterval?.toLowerCase() ?? "month"
                  } — you'll pay securely via Paystack.`}
            </p>
            {enrollError && <p className="mt-3 text-sm text-brand-rose">{enrollError}</p>}
            {notEnrolled.isFree ? (
              <Button className="mt-4" onClick={enroll} loading={enrolling}>
                Enroll
              </Button>
            ) : (
              <Button className="mt-4" onClick={pay} loading={enrolling}>
                Pay & Enroll
              </Button>
            )}
          </Card>
        </main>
      </>
    );
  }
  if (!course) {
    return (
      <>
        <SiteHeader nav={nav} right={<LogoutButton />} />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <div className="h-8 w-72 animate-pulse rounded-full bg-brand-gray/60" />
          <div className="mt-3 h-4 w-full max-w-md animate-pulse rounded-full bg-brand-gray/40" />
          <div className="mt-8">
            <SkeletonList rows={3} />
          </div>
        </main>
      </>
    );
  }

  const totalModules = course.modules.length;
  const completedModules = course.modules.filter((m) => m.completed).length;

  return (
    <>
      <SiteHeader nav={nav} right={<LogoutButton />} />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">{course.title}</h1>
        <p className="mt-1 text-xs text-gray-500">Taught by {course.createdBy.name} · AAICBI Staff</p>
        {course.description && <p className="mt-1 text-sm text-gray-600">{course.description}</p>}

        {totalModules > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>
                {completedModules} of {totalModules} module{totalModules === 1 ? "" : "s"} complete
              </span>
              <span>{Math.round((completedModules / totalModules) * 100)}%</span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100">
              <div
                className="h-1.5 rounded-full bg-brand-teal transition-all"
                style={{ width: `${(completedModules / totalModules) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* M15 — only ever renders once the API has actually confirmed
            a certificate exists for THIS trainee (see the "certificate"
            field's own comment on GET /api/courses/[id]) — not derived
            client-side from completedModules === totalModules, since
            that's just a display heuristic and the real trigger (all
            modules sticky-completed) lives server-side in progress.ts. */}
        {course.certificate && (
          <a href={`/certificate/${course.certificate.code}`} target="_blank" rel="noopener noreferrer">
            <Card variant="celebratory" interactive className="mt-4 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
                <span className="text-lg" aria-hidden="true">
                  🎓
                </span>{" "}
                Certificate earned — view &amp; share
              </span>
              <Badge variant="gold">{course.certificate.code} →</Badge>
            </Card>
          </a>
        )}

        {/* Course reviews — only ever shown once a genuine, non-revoked
            certificate exists for this course, the same signal the
            certificate block above already relies on. A trainee
            without one never sees this section at all, rather than
            seeing a form they'd be blocked from submitting. */}
        {course.certificate && <CourseReviewSection courseId={params.id} />}

        {/* M20 — same reasoning as the certificate block above: only
            ever renders badges the API has actually confirmed were
            awarded (see the "badges" field's own comment on
            GET /api/courses/[id]), never derived client-side from a
            locally-computed percentage. Purely motivational, no link
            anywhere — a badge isn't a credential the way a certificate
            is, so there's nothing to click through to. */}
        {course.badges.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {course.badges.map((b) => (
              <div key={b.threshold} className="flex items-center gap-2 rounded-full bg-brand-mint px-3 py-1.5">
                <AchievementDoodle className="h-5 w-5" />
                <span className="text-xs font-semibold text-brand-teal">{b.threshold}% complete</span>
              </div>
            ))}
          </div>
        )}

        {/* M22 — only ever shown once the API has confirmed a course
            examination exists and is published, same discipline as the
            certificate/badges blocks above. Audit finding, closed here:
            also requires every module to actually be complete — the
            link itself was previously clickable the moment a course
            examination was published, regardless of whether the
            trainee had done any course content at all. The real
            boundary is server-side (see the attempt route's own
            comment) — this is just showing an honest, informative
            state instead of a link that would only fail once clicked. */}
        {course.hasPublishedExamination && course.allModulesComplete && (
          <a href={`/trainee/courses/${params.id}/examination`}>
            <Card interactive className="mt-4 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
                <span className="text-lg" aria-hidden="true">
                  🎓
                </span>{" "}
                Course Examination available
              </span>
              <span className="text-xs font-semibold text-brand-teal">Start →</span>
            </Card>
          </a>
        )}
        {course.hasPublishedExamination && !course.allModulesComplete && (
          <Card className="mt-4">
            <span className="flex items-center gap-2 text-sm font-semibold text-gray-500">
              <span className="text-lg" aria-hidden="true">
                🎓
              </span>{" "}
              Course Examination — complete every module first
            </span>
          </Card>
        )}

        {course.modules.length === 0 && (
          <div className="mt-8">
            <EmptyState
              illustration={<GrowthPathDoodle className="h-full w-full" />}
              title="Nothing here yet"
              description="This course doesn't have any modules yet — check back soon."
            />
          </div>
        )}

        <div className="mt-8 space-y-3">
          {course.modules.map((mod, i) => (
            <Card key={mod.id} className={`overflow-hidden p-0 ${mod.unlocked ? "" : "bg-gray-50/60"}`}>
              <button
                onClick={() => setOpenModule(openModule === mod.id ? null : mod.id)}
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <div>
                  <div className={`flex flex-wrap items-center gap-1.5 font-display font-semibold ${mod.unlocked ? "text-brand-ink" : "text-gray-500"}`}>
                    <span>
                      {openModule === mod.id ? "▾" : "▸"} Module {i + 1}: {mod.title}
                    </span>
                    {mod.completed && <Badge variant="success">✓ Completed</Badge>}
                    {!mod.unlocked && <Badge variant="neutral">🔒 Locked</Badge>}
                  </div>
                  {mod.description && mod.unlocked && (
                    <div className="mt-0.5 text-sm text-gray-600">{mod.description}</div>
                  )}
                </div>
                {mod.unlocked && (
                  <span className="shrink-0 pl-3 text-xs text-gray-500">
                    {mod.lessons.length} lesson{mod.lessons.length === 1 ? "" : "s"}
                  </span>
                )}
              </button>

              {openModule === mod.id && !mod.unlocked && (
                <div className="flex flex-col items-center gap-2 border-t border-brand-gray p-6 text-center">
                  <LockedDoodle className="h-16 w-16" />
                  <p className="text-sm text-gray-500">Complete the previous module to unlock this one.</p>
                </div>
              )}

              {openModule === mod.id && mod.unlocked && (
                <div className="space-y-3 border-t border-brand-gray bg-gray-50/60 p-4">
                  <ModuleAssessmentStrip courseId={course.id} moduleId={mod.id} />
                  {mod.lessons.map((lesson) => (
                    <Card key={lesson.id} className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-brand-ink">{lesson.title}</div>
                          {lesson.description && <div className="text-xs text-gray-600">{lesson.description}</div>}
                        </div>
                        <LessonCompleteToggle
                          lessonId={lesson.id}
                          completed={lesson.completedByMe}
                          onChanged={(completed) => setLessonCompleted(mod.id, lesson.id, completed)}
                        />
                      </div>
                      <a
                        href={`/trainee/lessons/${lesson.id}/qa`}
                        className="mt-1 inline-block text-xs font-semibold text-brand-teal hover:underline"
                      >
                        💬 Q&amp;A
                      </a>
                      {lesson.materials.length > 0 ? (
                        <ul className="mt-2 space-y-3">
                          {lesson.materials.map((m) => (
                            <li key={m.id}>
                              <MaterialItem material={m} lowBandwidthMode={lowBandwidthMode} />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-xs text-gray-400">No materials attached yet.</p>
                      )}
                    </Card>
                  ))}
                  {mod.lessons.length === 0 && (
                    <p className="text-xs text-gray-400">No lessons in this module yet.</p>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      </main>
    </>
  );
}

interface CourseReviewDto {
  id: string;
  rating: number;
  reviewText: string | null;
}

/**
 * The trainee-facing review form — only ever rendered once the parent
 * has already confirmed a genuine, non-revoked certificate exists
 * (see the call site's own comment), matching the exact same "only
 * ever renders what the API has actually confirmed" discipline the
 * certificate block right above it already follows. An upsert under
 * the hood (see the API route's own comment), so this doubles as both
 * the "leave a review" and "edit your review" form without needing
 * two separate UIs.
 */
function CourseReviewSection({ courseId }: { courseId: string }) {
  const [review, setReview] = useState<CourseReviewDto | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    fetch(`/api/trainee/courses/${courseId}/review`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setReview(data);
          setRating(data.rating);
          setReviewText(data.reviewText ?? "");
        }
      })
      .finally(() => setLoaded(true));
  }, [courseId]);

  async function submit() {
    setSaving(true);
    const res = await fetch(`/api/trainee/courses/${courseId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, reviewText: reviewText.trim() || undefined }),
    });
    setSaving(false);
    if (!res.ok) {
      showToast("Could not save your review. Try again.", "error");
      return;
    }
    const data = await res.json();
    setReview(data);
    showToast(review ? "Review updated." : "Thanks for your review.");
  }

  if (!loaded) return null;

  return (
    <Card className="mt-4">
      <p className="font-display font-semibold text-brand-ink">
        {review ? "Your review" : "Rate your experience"}
      </p>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setRating(n)}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            className="text-2xl leading-none"
          >
            <span style={{ color: n <= rating ? "#d4a017" : "#d1d5db" }}>★</span>
          </button>
        ))}
      </div>
      <textarea
        value={reviewText}
        onChange={(e) => setReviewText(e.target.value)}
        placeholder="What stood out about this course? (optional)"
        aria-label="What stood out about this course? (optional)"
        rows={3}
        className="mt-3 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
      />
      <Button onClick={submit} loading={saving} disabled={rating === 0} className="mt-2">
        {review ? "Update Review" : "Submit Review"}
      </Button>
    </Card>
  );
}
