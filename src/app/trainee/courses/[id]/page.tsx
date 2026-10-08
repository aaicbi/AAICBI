"use client";
import { useEffect, useRef, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import { TRAINEE_NAV } from "@/lib/trainee/nav";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import MaterialTypeIcon from "@/components/ui/MaterialTypeIcon";
import CorrectnessMark from "@/components/ui/CorrectnessMark";
import Icon from "@/components/ui/Icon";
import AttentionPulse from "@/components/ui/AttentionPulse";
import { AchievementIcon, AssessmentIcon } from "@/components/icons/brand";
import { ChevronDown, ChevronRight, Lock, MessageSquare, MessageCircle, ArrowRight, Star } from "lucide-react";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";
import LockedDoodle from "@/components/doodles/LockedDoodle";
import AchievementDoodle from "@/components/doodles/AchievementDoodle";
import { extractYouTubeId, extractGoogleDriveFileId } from "@/lib/materialUrl";
import VideoPlayer from "@/components/video/VideoPlayer";
import CourseHero from "@/components/courses/CourseHero";
import { useToast } from "@/components/ui/Toast";
import CourseMarketingView from "@/components/courses/CourseMarketingView";
import type { MarketingView } from "@/lib/courseMarketing";

import { Textarea } from "@/components/ui/Field";
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
  // Free preview modules — only ever "payment" when this specific
  // module is locked because it's past the course's free-preview
  // boundary (distinct from "progress", the existing "complete the
  // previous module" reason); null when unlocked.
  lockedReason?: "payment" | "progress" | null;
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
          <span className={`ml-2 font-semibold ${best.passed ? "text-brand-teal" : "text-brand-goldText"}`}>
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
  instructorNames: string | null;
  flyerUrl?: string | null;
  showFlyer?: boolean;
  category?: string | null;
  publisherName?: string | null;
  modules: ModuleDto[];
  certificate: CertificateDto | null;
  badges: BadgeDto[];
  hasPublishedExamination: boolean;
  allModulesComplete: boolean;
  // Course enrollment/subscription system
  isFree: boolean;
  accessModel: "RECURRING_SUBSCRIPTION" | "FIXED_DURATION";
  currentPeriodEnd: string | null;
  daysRemaining: number | null;
  enrollmentStatus?: "ACTIVE" | "EXPIRED" | "COMPLETED" | "AWAITING_UNLOCK";
  enrollmentSource?: "FREE" | "ADMIN_GRANTED" | "PAID" | "PREVIEW" | null;
  isPaid?: boolean;
  whatsappGroupUrl: string | null;
  // Free preview modules
  isPreviewing?: boolean;
  freePreviewModuleCount?: number | null;
}

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
 * Lesson videos play inside the platform (see src/components/video/VideoPlayer.tsx):
 * a large 16:9 poster that loads nothing from YouTube or Drive until tapped,
 * an embedded player with its own fullscreen button, and an Expand button
 * for a large modal. Drive videos need "Anyone with the link" sharing for
 * the poster to show; without it the player falls back to a plain tap target.
 */

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
 *
 * Course Material PDF Export — a DOCX material gets an "Export ▾"
 * control instead of the plain button, offering a choice between the
 * original file and a converted PDF (the one material type this
 * platform can actually convert — see docxToPdf.ts's own header
 * comment for why PPTX isn't offered here too). Same hand-rolled
 * anchored-popover pattern as NotificationBell.tsx/FloatingMessagesButton.tsx
 * — there's no shared Dropdown component in this codebase yet.
 */
function DownloadButton({ materialId, title, materialType }: { materialId: string; title: string; materialType: MaterialDto["type"] }) {
  const [state, setState] = useState<"idle" | "downloading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleDownload(format?: "pdf") {
    setOpen(false);
    setState("downloading");
    setError(null);
    const res = await fetch(`/api/materials/${materialId}/download${format ? `?format=${format}` : ""}`);
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
    a.download = format === "pdf" ? `${title}.pdf` : title;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setState("idle");
  }

  const canExportPdf = materialType === "DOCX";

  return (
    <div>
      {canExportPdf ? (
        <div ref={containerRef} className="relative inline-block">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            disabled={state === "downloading"}
            aria-expanded={open}
            className="text-xs font-medium text-brand-teal hover:underline disabled:opacity-60"
          >
            {state === "downloading" ? "Downloading..." : "⬇ Export ▾"}
          </button>
          {open && (
            <div className="absolute left-0 top-full z-10 mt-1 w-44 rounded-lg border border-brand-gray bg-brand-surface py-1 shadow-lg animate-[modal-in_0.15s_ease-out]">
              <button
                type="button"
                onClick={() => handleDownload()}
                className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-brand-mint"
              >
                Original format (.docx)
              </button>
              <button
                type="button"
                onClick={() => handleDownload("pdf")}
                className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-brand-mint"
              >
                PDF format
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => handleDownload()}
          disabled={state === "downloading"}
          className="text-xs font-medium text-brand-teal hover:underline disabled:opacity-60"
        >
          {state === "downloading" ? "Downloading..." : "⬇ Download for offline"}
        </button>
      )}
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
            <MaterialTypeIcon type="VIDEO" /> {material.title}
          </p>
          <VideoPlayer source={{ kind: "youtube", id: videoId }} title={material.title} lowBandwidthMode={lowBandwidthMode} className="-mx-3 !w-[calc(100%+1.5rem)] !max-w-none rounded-none border-x-0 sm:mx-0 sm:!w-full sm:rounded-xl sm:border-x" />
          {/* No download button here — YouTube's Terms of Service don't
              allow downloading video content, and there's no legitimate
              way to fetch raw file bytes from a watch URL, so this
              button could only ever fail. See the download route's own
              comment for the full reasoning; Drive-hosted video below
              genuinely can be downloaded and keeps its button. */}
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
            <MaterialTypeIcon type="VIDEO" /> {material.title}
          </p>
          <VideoPlayer source={{ kind: "drive", id: driveFileId }} title={material.title} lowBandwidthMode={lowBandwidthMode} className="-mx-3 !w-[calc(100%+1.5rem)] !max-w-none rounded-none border-x-0 sm:mx-0 sm:!w-full sm:rounded-xl sm:border-x" />
          <DownloadButton materialId={material.id} title={material.title} materialType={material.type} />
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
        <MaterialTypeIcon type={material.type} /> {material.title}
      </a>
      <DownloadButton materialId={material.id} title={material.title} materialType={material.type} />
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
      {completed ? (
        <>
          <CorrectnessMark state="correct" label={undefined} /> Completed
        </>
      ) : (
        "Mark Complete"
      )}
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
// Course catalogue upgrade — widened to the full MarketingView shape;
// the API now returns this same shape for both the "never enrolled"
// and "access expired" cases, since both hit the same !enrolled
// branch in courses/[id]/route.ts. The expired-access UI below still
// only reads a handful of these fields (title/description/price) —
// it's a "renew your access" prompt, not the full marketing re-pitch
// the never-enrolled case now gets.
type NotEnrolledCourseDto = MarketingView;
interface ForbiddenResponseDto {
  error: string;
  notEnrolled?: boolean;
  expired?: boolean;
  enrollmentStatus?: string;
  course?: NotEnrolledCourseDto;
  // Free preview modules
  previewAvailable?: boolean;
  previewModuleCount?: number | null;
}

export default function TraineeCourseViewPage({ params }: { params: { id: string } }) {
  const [course, setCourse] = useState<CourseDto | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [notEnrolled, setNotEnrolled] = useState<NotEnrolledCourseDto | null>(null);
  const [previewOffer, setPreviewOffer] = useState<{ moduleCount: number } | null>(null);
  const [expiredInfo, setExpiredInfo] = useState<{ isExpired: boolean; course: NotEnrolledCourseDto } | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [openModule, setOpenModule] = useState<string | null>(null);

  function loadCourse() {
    fetch(`/api/courses/${params.id}`)
      .then(async (r) => {
        if (r.status === 403) {
          const data: ForbiddenResponseDto | null = await r.json().catch(() => null);
          if (data?.expired && data?.course) {
            setExpiredInfo({ isExpired: true, course: data.course });
            setNotEnrolled(null);
          } else {
            setNotEnrolled(data?.course ?? null);
            setExpiredInfo(null);
          }
          setPreviewOffer(data?.previewAvailable && data.previewModuleCount ? { moduleCount: data.previewModuleCount } : null);
          return;
        }
        setExpiredInfo(null);
        setPreviewOffer(null);
        if (!r.ok) {
          setNotFound(true);
          return;
        }
        const data = await r.json();
        setCourse(data);
        setNotEnrolled(null);
        // Resume-from-dashboard support: getResumeTarget links here
        // with ?module=<id> (and, for a specific next lesson,
        // &lesson=<id> too — see the scroll-into-view effect below) so
        // "Resume" actually opens the right module instead of always
        // defaulting to the first one.
        const moduleParam = new URLSearchParams(window.location.search).get("module");
        setOpenModule((current) => current ?? moduleParam ?? data.modules[0]?.id ?? null);
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

    // Dynamically load Paystack Inline JS script if not already present
    if (typeof window !== "undefined" && !(window as unknown as { PaystackPop?: unknown }).PaystackPop) {
      await new Promise<void>((resolve) => {
        const script = document.createElement("script");
        script.src = "https://js.paystack.co/v1/inline.js";
        script.onload = () => resolve();
        script.onerror = () => resolve(); // proceed even if script fails to load
        document.body.appendChild(script);
      });
    }

    const res = await fetch(`/api/courses/${params.id}/pay`, { method: "POST" });
    setEnrolling(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setEnrollError(typeof data.error === "string" ? data.error : "Could not start payment. Try again.");
      return;
    }
    const data = await res.json();

    const PaystackPop = (window as unknown as {
      PaystackPop?: { setup: (options: Record<string, unknown>) => { openIframe: () => void } };
    }).PaystackPop;

    if (PaystackPop && data.accessCode) {
      const paystackOptions: Record<string, unknown> = {
        accessCode: data.accessCode,
        email: data.email,
        amount: data.amountKobo,
        onClose: () => {
          loadCourse();
        },
        callback: () => {
          loadCourse();
        },
      };
      if (process.env.NEXT_PUBLIC_PAYSTACK_KEY) {
        paystackOptions.key = process.env.NEXT_PUBLIC_PAYSTACK_KEY;
      }
      const handler = PaystackPop.setup(paystackOptions);
      handler.openIframe();
    } else {
      // Fallback to full-page redirect if script wasn't loaded / accessCode missing
      window.location.href = data.authorizationUrl;
    }
  }

  useEffect(() => {
    loadCourse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  // Companion to the ?module= handling above: once the course (and its
  // now-open module) has rendered, scroll the specific lesson
  // getResumeTarget pointed at into view — same "exact next lesson"
  // resume behavior the dashboard card promises, just landing here
  // instead of on a standalone lesson page that doesn't exist.
  useEffect(() => {
    if (!course) return;
    const lessonParam = new URLSearchParams(window.location.search).get("lesson");
    if (!lessonParam) return;
    const t = setTimeout(() => {
      document.getElementById(`lesson-${lessonParam}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => clearTimeout(t);
  }, [course]);

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

  if (notFound) {
    return (
      <>
        <SiteHeader nav={TRAINEE_NAV} right={<LogoutButton />} />
        <main className="mx-auto max-w-2xl px-6 py-10 text-center text-gray-600">
          Course not found, or it isn&apos;t published yet.
        </main>
      </>
    );
  }
  if (expiredInfo) {
    return (
      <>
        <SiteHeader nav={TRAINEE_NAV} right={<LogoutButton />} />
        <main className="mx-auto max-w-2xl px-6 py-10">
          <Card variant="highlighted">
            <div className="flex items-center justify-between">
              <h1 className="font-display text-xl font-semibold text-brand-ink">{expiredInfo.course.title}</h1>
              <Badge variant="danger">EXPIRED</Badge>
            </div>
            {expiredInfo.course.description && <p className="mt-2 text-sm text-gray-600">{expiredInfo.course.description}</p>}
            <div className="mt-4 rounded-lg border border-brand-rose bg-brand-roseLight/40 p-4 text-sm text-brand-rose">
              <p className="font-semibold">Your course access has expired.</p>
              <p className="mt-1 text-gray-700">
                Restricted course materials are locked. Re-enroll or renew below to restore full access. Your past enrollment history and progress are safely preserved.
              </p>
            </div>
            {enrollError && <p className="mt-3 text-sm text-brand-rose">{enrollError}</p>}
            {expiredInfo.course.isFree ? (
              <Button className="mt-4" onClick={enroll} loading={enrolling}>
                Re-enroll (Free)
              </Button>
            ) : (
              <Button className="mt-4" onClick={pay} loading={enrolling}>
                Renew Access (₦{((expiredInfo.course.effectivePriceKobo ?? expiredInfo.course.priceKobo ?? 0) / 100).toLocaleString()})
              </Button>
            )}
          </Card>
        </main>
      </>
    );
  }
  if (notEnrolled) {
    return (
      <>
        <SiteHeader nav={TRAINEE_NAV} right={<LogoutButton />} />
        <CourseMarketingView
          data={notEnrolled}
          actions={
            <div>
              <p className="text-sm text-gray-600">
                You&apos;re not enrolled in this course yet.
                {notEnrolled.isFree
                  ? " It's free — enroll below to get started."
                  : ` ₦${((notEnrolled.effectivePriceKobo ?? notEnrolled.priceKobo ?? 0) / 100).toLocaleString()} / ${
                      notEnrolled.billingInterval?.toLowerCase() ?? "month"
                    } — you'll pay securely via Paystack.`}
              </p>
              {/* Free preview modules — offered alongside, never instead
                  of, paying outright: a trainee who already knows they
                  want the course can still skip straight to Pay & Enroll. */}
              {!notEnrolled.isFree && previewOffer && (
                <p className="mt-2 text-sm text-brand-tealDeep">
                  Not ready to pay yet? Preview the first {previewOffer.moduleCount} module
                  {previewOffer.moduleCount === 1 ? "" : "s"} free — lessons and assessments included.
                </p>
              )}
              {enrollError && <p className="mt-2 text-sm text-brand-rose">{enrollError}</p>}
              {notEnrolled.isFree ? (
                <Button className="mt-3" onClick={enroll} loading={enrolling}>
                  Enroll
                </Button>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={pay} loading={enrolling}>
                    Pay & Enroll
                  </Button>
                  {previewOffer && (
                    <Button variant="secondary" onClick={enroll} loading={enrolling}>
                      Start Free Preview
                    </Button>
                  )}
                </div>
              )}
            </div>
          }
        />
      </>
    );
  }
  if (!course) {
    return (
      <>
        <SiteHeader nav={TRAINEE_NAV} right={<LogoutButton />} />
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
      <SiteHeader nav={TRAINEE_NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-5xl px-3 py-6 sm:px-6 sm:py-10">
        <CourseHero
          title={course.title}
          imageUrl={course.showFlyer === false ? null : course.flyerUrl}
          publisher={course.publisherName}
          category={course.category}
          overview={course.description}
          badges={
            <>
              {course.isPaid ? (
                <Badge variant="success">
                  PAID <CorrectnessMark state="correct" label={undefined} />
                </Badge>
              ) : course.isFree ? (
                <Badge variant="neutral">FREE</Badge>
              ) : null}
              {course.enrollmentStatus === "EXPIRED" ? (
                <Badge variant="danger">EXPIRED</Badge>
              ) : course.enrollmentStatus === "ACTIVE" ? (
                <Badge variant="success">ACCESS ACTIVE</Badge>
              ) : course.enrollmentStatus === "COMPLETED" ? (
                <Badge variant="gold">
                  COMPLETED <Icon icon={AchievementIcon} size="sm" className="inline align-text-bottom" />
                </Badge>
              ) : null}
            </>
          }
        >
          {/* Bug fix: this used to always show course.createdBy.name —
              whichever admin/instructor account built the course in the
              builder, not necessarily who actually teaches it. Prefers
              the real, admin-typed instructorNames field (see its own
              schema comment — free-text display copy, deliberately not
              tied to a staff account) and only falls back to the
              creator's name for a course that hasn't set it yet, so
              nothing regresses to blank. */}
          <p className="mt-3 break-words text-xs text-gray-500 [overflow-wrap:anywhere]">
            Taught by {course.instructorNames || course.createdBy.name}
          </p>
        </CourseHero>

        {/* WhatsApp group-study link — only ever shown here, on the
            already-enrolled trainee's own course page, never on the
            public marketing page. Presence of the URL is what shows
            the button; see the schema comment on
            Course.whatsappGroupUrl for why there's no separate
            visibility toggle. */}
        {course.whatsappGroupUrl && (
          <div className="mt-3">
            {/* Deliberately not the shared Button component's variants
                here — a request to make this specific CTA noticeable
                at rest (teal outline, not just on hover) with a
                distinctly different, filled look on hover, which isn't
                one of Button's existing variants. */}
            <a
              href={course.whatsappGroupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border-2 border-brand-teal px-4 py-2 text-sm font-semibold text-brand-teal transition-colors hover:bg-brand-teal hover:text-brand-onAccent"
            >
              <Icon icon={MessageCircle} size="sm" />
              Join WhatsApp Group
            </a>
          </div>
        )}

        {/* Payment & Access Summary Strip */}
        <Card className="mt-4 grid grid-cols-2 gap-3 p-4 text-xs sm:grid-cols-4">
          <div>
            <span className="text-gray-500 block">Payment Status</span>
            <span className="inline-flex items-center gap-1 font-semibold text-brand-ink">
              {course.isPaid ? (
                <>
                  Paid <CorrectnessMark state="correct" label={undefined} />
                </>
              ) : (
                "Free"
              )}
            </span>
          </div>
          <div>
            <span className="text-gray-500 block">Access Status</span>
            <span className="font-semibold text-brand-ink">{course.enrollmentStatus ?? "ACTIVE"}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Access Expiration</span>
            <span className="font-semibold text-brand-ink">
              {course.currentPeriodEnd ? new Date(course.currentPeriodEnd).toLocaleDateString() : "Lifetime / Unlimited"}
            </span>
          </div>
          <div>
            <span className="text-gray-500 block">Time Remaining</span>
            <span className="font-semibold text-brand-ink">
              {course.daysRemaining !== null ? `${course.daysRemaining} day(s)` : "N/A"}
            </span>
          </div>
        </Card>

        {/* Course enrollment/subscription system — a status banner for
            a paid enrollment, matching task Section 17's dashboard
            example format. Free courses and RECURRING_SUBSCRIPTION
            courses (auto-renewing, no action needed from the trainee)
            never show this at all; a FIXED_DURATION course only shows
            it once real days-remaining data exists (daysRemaining is
            server-computed — see GET /api/courses/[id]'s own comment on
            why that's never derived from a raw date client-side). */}
        {!course.isFree && course.accessModel === "FIXED_DURATION" && course.daysRemaining !== null && (
          <Card
            variant={course.daysRemaining <= 7 ? "highlighted" : "default"}
            className="mt-4 flex items-center justify-between"
          >
            <p className="text-sm text-brand-ink">
              {course.daysRemaining > 0 ? (
                <>
                  <span className="font-semibold">{course.daysRemaining}</span> day
                  {course.daysRemaining === 1 ? "" : "s"} of access remaining
                  {course.currentPeriodEnd && ` (until ${new Date(course.currentPeriodEnd).toLocaleDateString()})`}
                </>
              ) : (
                "Your access has expired"
              )}
            </p>
            {course.daysRemaining <= 14 && (
              <Button onClick={pay} loading={enrolling}>
                Renew Access
              </Button>
            )}
          </Card>
        )}
        {enrollError && course.daysRemaining !== null && <p className="mt-2 text-xs text-brand-rose">{enrollError}</p>}

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
                <Icon icon={AchievementIcon} size="lg" />
                Certificate earned — view &amp; share
              </span>
              <Badge variant="gold">
                {course.certificate.code} <Icon icon={ArrowRight} size="sm" className="inline" />
              </Badge>
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
                <AttentionPulse icon={AssessmentIcon} size="lg" />
                Course Examination available
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-teal">
                Start <Icon icon={ArrowRight} size="sm" />
              </span>
            </Card>
          </a>
        )}
        {course.hasPublishedExamination && !course.allModulesComplete && (
          <Card className="mt-4">
            <span className="flex items-center gap-2 text-sm font-semibold text-gray-500">
              <Icon icon={AssessmentIcon} size="lg" />
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
            <Card key={mod.id} className={`overflow-hidden !p-0 ${mod.unlocked ? "" : "bg-gray-50/60"}`}>
              <button
                onClick={() => setOpenModule(openModule === mod.id ? null : mod.id)}
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <div className="min-w-0">
                  <div className={`flex flex-wrap items-center gap-1.5 break-words font-display font-semibold [overflow-wrap:anywhere] ${mod.unlocked ? "text-brand-ink" : "text-gray-500"}`}>
                    <span className="inline-flex items-center gap-1">
                      <Icon icon={openModule === mod.id ? ChevronDown : ChevronRight} size="sm" /> Module {i + 1}: {mod.title}
                    </span>
                    {mod.completed && (
                      <Badge variant="success">
                        <CorrectnessMark state="correct" label={undefined} /> Completed
                      </Badge>
                    )}
                    {!mod.unlocked && (
                      <Badge variant={mod.lockedReason === "payment" ? "warning" : "neutral"}>
                        <Icon icon={Lock} size="sm" className="mr-1 inline align-text-bottom" />{" "}
                        {mod.lockedReason === "payment" ? "Pay to Unlock" : "Locked"}
                      </Badge>
                    )}
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
                  {mod.lockedReason === "payment" ? (
                    <>
                      <p className="text-sm text-gray-600">
                        You&apos;ve completed the free preview — pay to continue with this course.
                      </p>
                      {enrollError && <p className="text-sm text-brand-rose">{enrollError}</p>}
                      <Button className="mt-1" onClick={pay} loading={enrolling}>
                        Pay Now
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">Complete the previous module to unlock this one.</p>
                  )}
                </div>
              )}

              {openModule === mod.id && mod.unlocked && (
                <div className="space-y-0 border-t border-brand-gray bg-gray-50/60 p-0 sm:space-y-3 sm:p-4">
                  <div className="p-3 sm:p-0">
                    <ModuleAssessmentStrip courseId={course.id} moduleId={mod.id} />
                  </div>
                  {mod.lessons.map((lesson) => (
                    <div key={lesson.id} id={`lesson-${lesson.id}`} className="border-b border-brand-gray bg-brand-surface p-3 last:border-b-0 sm:rounded-xl sm:border sm:p-4 sm:last:border-b">
                      <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="break-words text-sm font-semibold text-brand-ink [overflow-wrap:anywhere]">{lesson.title}</div>
                          {lesson.description && <div className="mt-0.5 line-clamp-3 break-words text-xs text-gray-600 [overflow-wrap:anywhere]">{lesson.description}</div>}
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
                        <Icon icon={MessageSquare} size="sm" className="mr-1 inline align-text-bottom" /> Q&amp;A
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
                    </div>
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
            className="leading-none"
          >
            <Icon icon={Star} size="lg" className={n <= rating ? "fill-brand-gold text-brand-gold" : "fill-none text-brand-gray"} />
          </button>
        ))}
      </div>
      <Textarea label="What stood out about this course? (optional)" hideLabel compact value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="What stood out about this course? (optional)" rows={3} />
      <Button onClick={submit} loading={saving} disabled={rating === 0} className="mt-2">
        {review ? "Update Review" : "Submit Review"}
      </Button>
    </Card>
  );
}
