"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import { useConfirmModal } from "@/components/ui/useConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";

interface MaterialDto {
  id: string;
  type: "PDF" | "DOCX" | "PPTX" | "VIDEO";
  title: string;
  url: string;
  order: number;
}
interface LessonDto {
  id: string;
  title: string;
  description: string | null;
  order: number;
  materials: MaterialDto[];
}
interface ModuleDto {
  id: string;
  title: string;
  description: string | null;
  order: number;
  lessons: LessonDto[];
}
interface CourseDto {
  id: string;
  title: string;
  description: string | null;
  published: boolean;
  modules: ModuleDto[];
  // M38
  inactivityThresholdDays: number | null;
  failedAttemptsThreshold: number | null;
  // M45
  aiCreditAllowanceOverride: number | null;
  isFree: boolean;
  // M41
  qaScope: "OPEN" | "COHORT_SCOPED";
}

/** Parses the { error: { fieldErrors, formErrors } | string } shapes the
 * API routes return into one human-readable line. Centralised here so
 * every create/update call in this page reports failures the same way,
 * instead of some silently swallowing them (the M10 audit's finding #4). */
async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.error === "string") return body.error;
    const fieldErrors = body?.error?.fieldErrors;
    if (fieldErrors) {
      const first = Object.values(fieldErrors).flat()[0];
      if (typeof first === "string") return first;
    }
    const formErrors = body?.error?.formErrors;
    if (Array.isArray(formErrors) && formErrors[0]) return formErrors[0];
  } catch {
    /* fall through to fallback */
  }
  return fallback;
}

export default function CourseBuilderPage({ params }: { params: { id: string } }) {
  const [course, setCourse] = useState<CourseDto | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [addingModule, setAddingModule] = useState(false);
  const [editingCourse, setEditingCourse] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const { confirm, modal } = useConfirmModal();
  const { showToast } = useToast();

  async function loadCourse() {
    const res = await fetch(`/api/courses/${params.id}`);
    if (!res.ok) {
      setNotFound(true);
      return;
    }
    setCourse(await res.json());
  }

  useEffect(() => {
    loadCourse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function togglePublish() {
    if (!course) return;
    setPublishError(null);
    const nextPublished = !course.published;
    if (nextPublished && course.modules.length === 0) {
      setPublishError("Add at least one module before publishing.");
      return;
    }
    const res = await fetch(`/api/courses/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: nextPublished }),
    });
    if (!res.ok) {
      setPublishError(await readApiError(res, "Could not update the course. Try again."));
      return;
    }
    await loadCourse();
  }

  // M45 — same PUT endpoint, same reasoning as updateEarlyWarningThresholds
  // right above: a genuinely different concern from title/description,
  // its own small local edit state below.
  async function updateAiCreditOverride(aiCreditAllowanceOverride: number | null): Promise<string | null> {
    const res = await fetch(`/api/courses/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiCreditAllowanceOverride }),
    });
    if (!res.ok) return readApiError(res, "Could not save. Try again.");
    await loadCourse();
    return null;
  }

  async function updateQaScope(qaScope: "OPEN" | "COHORT_SCOPED"): Promise<string | null> {
    const res = await fetch(`/api/courses/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qaScope }),
    });
    if (!res.ok) return readApiError(res, "Could not save. Try again.");
    await loadCourse();
    return null;
  }

  async function updateCourse(title: string, description: string): Promise<string | null> {
    const res = await fetch(`/api/courses/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });
    if (!res.ok) return readApiError(res, "Could not save. Try again.");
    setEditingCourse(false);
    await loadCourse();
    return null;
  }

  // M38 — same PUT endpoint as updateCourse above (the course update
  // route accepts a partial body, see UpdateCourseSchema), a separate
  // function only because this is a genuinely different concern
  // (early-warning settings, not title/description) with its own
  // small local edit state below in EarlyWarningSettings.
  async function updateEarlyWarningThresholds(
    inactivityThresholdDays: number | null,
    failedAttemptsThreshold: number | null
  ): Promise<string | null> {
    const res = await fetch(`/api/courses/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inactivityThresholdDays, failedAttemptsThreshold }),
    });
    if (!res.ok) return readApiError(res, "Could not save. Try again.");
    await loadCourse();
    return null;
  }

  async function addModule(title: string, description: string): Promise<string | null> {
    const res = await fetch(`/api/courses/${params.id}/modules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });
    if (!res.ok) return readApiError(res, "Could not add the module. Try again.");
    setAddingModule(false);
    await loadCourse();
    return null;
  }

  async function deleteModule(moduleId: string) {
    const ok = await confirm({
      title: "Delete this module?",
      description: "This deletes everything inside it too — lessons, materials, and its assessment if it has one.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/modules/${moduleId}`, { method: "DELETE" });
    if (!res.ok) {
      showToast(await readApiError(res, "Could not delete the module. Try again."), "error");
      return;
    }
    showToast("Module deleted.", "success");
    await loadCourse();
  }

  if (notFound) {
    return (
      <>
        <SiteHeader right={<LogoutButton />} />
        <main className="mx-auto max-w-2xl px-6 py-10 text-center text-gray-600">Course not found.</main>
      </>
    );
  }
  if (!course) {
    return (
      <>
        <SiteHeader right={<LogoutButton />} />
        <main className="mx-auto max-w-2xl px-6 py-10">
          <SkeletonList />
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader
        nav={[
          { label: "Examinations", href: "/admin/dashboard" },
          { label: "Courses", href: "/admin/courses" },
          { label: "Settings", href: "/admin/settings" },
        ]}
        right={<LogoutButton />}
      />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            {editingCourse ? (
              <AddForm
                fields={["title", "description"]}
                initialTitle={course.title}
                initialDescription={course.description ?? ""}
                submitLabel="Save"
                onCancel={() => setEditingCourse(false)}
                onSubmit={(v) => updateCourse(v.title, v.description)}
              />
            ) : (
              <button onClick={() => setEditingCourse(true)} className="text-left hover:opacity-80">
                <h1 className="text-2xl font-bold text-gray-900">{course.title} <span className="text-sm font-normal text-brand-teal">(edit)</span></h1>
                {course.description && <p className="mt-1 text-sm text-gray-600">{course.description}</p>}
              </button>
            )}
          </div>
          <div className="shrink-0 text-right">
            <a
              href={`/admin/courses/${params.id}/certificates`}
              className="mb-2 block text-xs font-semibold text-brand-teal hover:underline"
            >
              🎓 Certificates Issued
            </a>
            <a
              href={`/admin/courses/${params.id}/qa`}
              className="mb-2 block text-xs font-semibold text-brand-teal hover:underline"
            >
              💬 Q&amp;A
            </a>
            <a
              href={`/admin/courses/${params.id}/enrollments`}
              className="mb-2 block text-xs font-semibold text-brand-teal hover:underline"
            >
              🔑 Enrollments
            </a>
            <a
              href={`/admin/courses/${params.id}/cohorts`}
              className="mb-2 block text-xs font-semibold text-brand-teal hover:underline"
            >
              👥 Cohorts / Intakes
            </a>
            <a
              href={`/admin/courses/${params.id}/early-warnings`}
              className="mb-2 block text-xs font-semibold text-brand-teal hover:underline"
            >
              ⚠️ Early Warnings
            </a>
            <a
              href={`/admin/courses/${params.id}/examination`}
              className="mb-2 block text-xs font-semibold text-brand-teal hover:underline"
            >
              🎓 Course Examination
            </a>
            <button
              onClick={togglePublish}
              className={
                course.published
                  ? "rounded-lg border border-brand-gray px-4 py-2 text-sm font-semibold hover:border-brand-rose hover:text-brand-rose"
                  : "rounded-lg bg-brand-teal px-4 py-2 text-sm font-semibold text-white hover:bg-brand-tealDeep"
              }
            >
              {course.published ? "Unpublish" : "Publish"}
            </button>
            {publishError && <p className="mt-1 max-w-[16rem] text-xs text-brand-rose">{publishError}</p>}
          </div>
        </div>

        <EarlyWarningSettings course={course} onSave={updateEarlyWarningThresholds} showToast={showToast} />

        <AiCreditOverrideSettings course={course} onSave={updateAiCreditOverride} showToast={showToast} />

        <QaScopeSettings course={course} onSave={updateQaScope} showToast={showToast} />

        <div className="mt-8 space-y-4">
          {course.modules.map((mod) => (
            <ModuleCard key={mod.id} module={mod} onChanged={loadCourse} onDelete={() => deleteModule(mod.id)} />
          ))}
        </div>

        <div className="mt-6">
          {addingModule ? (
            <AddForm
              fields={["title", "description"]}
              submitLabel="Add Module"
              onCancel={() => setAddingModule(false)}
              onSubmit={(v) => addModule(v.title, v.description)}
            />
          ) : (
            <button
              onClick={() => setAddingModule(true)}
              className="w-full rounded-lg border border-dashed border-brand-gray py-3 text-sm font-semibold text-gray-600 hover:border-brand-teal hover:text-brand-teal"
            >
              + Add Module
            </button>
          )}
        </div>
      </main>
    </>
  );
}

// M38 — a course's own early-warning thresholds. Null (shown as "Off")
// means the feature is disabled for this course, matching the schema
// comment on Course.inactivityThresholdDays/failedAttemptsThreshold —
// no existing course starts generating alerts nobody asked for just
// because this milestone shipped.
function EarlyWarningSettings({
  course,
  onSave,
  showToast,
}: {
  course: CourseDto;
  onSave: (inactivityThresholdDays: number | null, failedAttemptsThreshold: number | null) => Promise<string | null>;
  showToast: (message: string, variant?: "success" | "error") => void;
}) {
  const [editing, setEditing] = useState(false);
  const [inactivityDays, setInactivityDays] = useState(course.inactivityThresholdDays?.toString() ?? "");
  const [failedAttempts, setFailedAttempts] = useState(course.failedAttemptsThreshold?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setInactivityDays(course.inactivityThresholdDays?.toString() ?? "");
    setFailedAttempts(course.failedAttemptsThreshold?.toString() ?? "");
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const err = await onSave(
      inactivityDays.trim() === "" ? null : Number(inactivityDays),
      failedAttempts.trim() === "" ? null : Number(failedAttempts)
    );
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setEditing(false);
    showToast("Early-warning settings saved.");
  }

  const inactivityLabel = course.inactivityThresholdDays ? `${course.inactivityThresholdDays} days` : "Off";
  const failedAttemptsLabel = course.failedAttemptsThreshold ? `${course.failedAttemptsThreshold} attempts` : "Off";

  return (
    <div className="mt-4 rounded-lg border border-brand-gray bg-gray-50 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">⚠️ Early-Warning Thresholds</p>
          {!editing && (
            <p className="mt-1 text-xs text-gray-600">
              Inactivity: <span className="font-medium">{inactivityLabel}</span> · Failed attempts (per module):{" "}
              <span className="font-medium">{failedAttemptsLabel}</span>
            </p>
          )}
        </div>
        {!editing && (
          <button onClick={startEditing} className="text-xs font-semibold text-brand-teal hover:underline">
            Edit
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-3 space-y-3">
          <label className="block text-xs text-gray-700">
            Flag a trainee after this many days with no login (blank = off)
            <input
              type="number"
              min={1}
              value={inactivityDays}
              onChange={(e) => setInactivityDays(e.target.value)}
              placeholder="e.g. 7"
              className="mt-1 w-full max-w-[10rem] rounded-lg border border-brand-gray px-2 py-1.5 text-sm outline-none focus:border-brand-teal"
            />
          </label>
          <label className="block text-xs text-gray-700">
            Flag a trainee after this many failed attempts on one module assessment (blank = off)
            <input
              type="number"
              min={1}
              value={failedAttempts}
              onChange={(e) => setFailedAttempts(e.target.value)}
              placeholder="e.g. 3"
              className="mt-1 w-full max-w-[10rem] rounded-lg border border-brand-gray px-2 py-1.5 text-sm outline-none focus:border-brand-teal"
            />
          </label>
          {error && <p className="text-xs text-brand-rose">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-brand-teal px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg border border-brand-gray px-3 py-1.5 text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// M45 — this course's AI credit allowance override. Null means "use
// the platform-wide default" (set at /admin/platform-settings), the
// same "default plus optional per-course override" shape as the
// early-warning thresholds right above.
function AiCreditOverrideSettings({
  course,
  onSave,
  showToast,
}: {
  course: CourseDto;
  onSave: (aiCreditAllowanceOverride: number | null) => Promise<string | null>;
  showToast: (message: string, variant?: "success" | "error") => void;
}) {
  const [editing, setEditing] = useState(false);
  const [override, setOverride] = useState(course.aiCreditAllowanceOverride?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setOverride(course.aiCreditAllowanceOverride?.toString() ?? "");
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const err = await onSave(override.trim() === "" ? null : Number(override));
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setEditing(false);
    showToast("AI credit override saved.");
  }

  const label = course.aiCreditAllowanceOverride !== null ? `${course.aiCreditAllowanceOverride} credits` : "Platform default";

  return (
    <div className="mt-4 rounded-lg border border-brand-gray bg-gray-50 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">🤖 AI Study Buddy Credit Override</p>
          {!editing && (
            <p className="mt-1 text-xs text-gray-600">
              Granted per paid enrollment/renewal: <span className="font-medium">{label}</span>
            </p>
          )}
        </div>
        {!editing && (
          <button onClick={startEditing} className="text-xs font-semibold text-brand-teal hover:underline">
            Edit
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-3 space-y-3">
          <label className="block text-xs text-gray-700">
            Credits granted for this course specifically (blank = use the platform default)
            <input
              type="number"
              min={0}
              value={override}
              onChange={(e) => setOverride(e.target.value)}
              placeholder="e.g. 100"
              className="mt-1 w-full max-w-[10rem] rounded-lg border border-brand-gray px-2 py-1.5 text-sm outline-none focus:border-brand-teal"
            />
          </label>
          {error && <p className="text-xs text-brand-rose">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-brand-teal px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg border border-brand-gray px-3 py-1.5 text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// M41 — a real, deliberate choice per course, matching the roadmap's
// own scope: cohort-scoped or fully open, not a fixed platform-wide
// setting. Deliberately no confirmation dialog on toggling this —
// existing threads keep whatever scope they were actually created
// under (see the schema comment on QaThread.cohortId), so switching
// this doesn't retroactively change or hide anything already posted.
function QaScopeSettings({
  course,
  onSave,
  showToast,
}: {
  course: CourseDto;
  onSave: (qaScope: "OPEN" | "COHORT_SCOPED") => Promise<string | null>;
  showToast: (message: string, variant?: "success" | "error") => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(value: "OPEN" | "COHORT_SCOPED") {
    if (value === course.qaScope) return;
    setSaving(true);
    setError(null);
    const err = await onSave(value);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    showToast("Q&A scope saved.");
  }

  return (
    <div className="mt-4 rounded-lg border border-brand-gray bg-gray-50 p-4">
      <p className="text-sm font-semibold text-gray-900">💬 Q&amp;A Scope</p>
      <p className="mt-1 text-xs text-gray-600">
        Who can see and post in a thread. Cohort-scoped only makes sense once real cohorts exist for this course.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          disabled={saving}
          onClick={() => handleChange("OPEN")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            course.qaScope === "OPEN" ? "bg-brand-teal text-white" : "border border-brand-gray"
          }`}
        >
          Open (everyone)
        </button>
        <button
          disabled={saving}
          onClick={() => handleChange("COHORT_SCOPED")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            course.qaScope === "COHORT_SCOPED" ? "bg-brand-teal text-white" : "border border-brand-gray"
          }`}
        >
          Cohort-scoped
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-brand-rose">{error}</p>}
    </div>
  );
}

function ModuleCard({
  module: mod,
  onChanged,
  onDelete,
}: {
  module: ModuleDto;
  onChanged: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [addingLesson, setAddingLesson] = useState(false);
  const [editing, setEditing] = useState(false);
  const { confirm, modal } = useConfirmModal();
  const { showToast } = useToast();

  async function addLesson(title: string, description: string): Promise<string | null> {
    const res = await fetch(`/api/modules/${mod.id}/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });
    if (!res.ok) return readApiError(res, "Could not add the lesson. Try again.");
    setAddingLesson(false);
    onChanged();
    return null;
  }

  async function updateModule(title: string, description: string): Promise<string | null> {
    const res = await fetch(`/api/modules/${mod.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });
    if (!res.ok) return readApiError(res, "Could not save. Try again.");
    setEditing(false);
    onChanged();
    return null;
  }

  async function deleteLesson(lessonId: string) {
    const ok = await confirm({
      title: "Delete this lesson?",
      description: "This deletes its materials too — this can't be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/lessons/${lessonId}`, { method: "DELETE" });
    if (!res.ok) {
      showToast(await readApiError(res, "Could not delete the lesson. Try again."), "error");
      return;
    }
    showToast("Lesson deleted.", "success");
    onChanged();
  }

  return (
    <div className="rounded-lg border border-brand-gray">
      {modal}
      <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
        {editing ? (
          <div className="flex-1">
            <AddForm
              fields={["title", "description"]}
              initialTitle={mod.title}
              initialDescription={mod.description ?? ""}
              submitLabel="Save"
              onCancel={() => setEditing(false)}
              onSubmit={(v) => updateModule(v.title, v.description)}
            />
          </div>
        ) : (
          <>
            <button onClick={() => setExpanded((e) => !e)} className="flex-1 text-left">
              <div className="font-semibold text-gray-900">
                {expanded ? "▾" : "▸"} {mod.title}
              </div>
              {mod.description && <div className="mt-0.5 text-sm text-gray-600">{mod.description}</div>}
              <div className="mt-0.5 text-xs text-gray-500">
                {mod.lessons.length} lesson{mod.lessons.length === 1 ? "" : "s"}
              </div>
            </button>
            <div className="flex shrink-0 gap-3">
              {/* M11 — a module's bank-backed assessment lives on its own
                  page (upload/review/publish is a much bigger surface
                  than fits inline in this already-611-line builder) */}
              <a href={`/admin/modules/${mod.id}/assessment`} className="text-xs font-semibold text-brand-teal hover:underline">
                Assessment
              </a>
              <button onClick={() => setEditing(true)} className="text-xs font-semibold text-brand-teal hover:underline">
                Edit
              </button>
              <button onClick={onDelete} className="text-xs font-semibold text-brand-rose hover:underline">
                Delete
              </button>
            </div>
          </>
        )}
      </div>

      {expanded && !editing && (
        <div className="space-y-3 border-t border-brand-gray bg-gray-50/60 p-4">
          {mod.lessons.map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} onChanged={onChanged} onDelete={() => deleteLesson(lesson.id)} />
          ))}

          {addingLesson ? (
            <AddForm
              fields={["title", "description"]}
              submitLabel="Add Lesson"
              onCancel={() => setAddingLesson(false)}
              onSubmit={(v) => addLesson(v.title, v.description)}
            />
          ) : (
            <button
              onClick={() => setAddingLesson(true)}
              className="w-full rounded-lg border border-dashed border-brand-gray bg-white dark:bg-brand-surface py-2 text-xs font-semibold text-gray-600 hover:border-brand-teal hover:text-brand-teal"
            >
              + Add Lesson
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const MATERIAL_ICON: Record<MaterialDto["type"], string> = {
  PDF: "📄",
  DOCX: "📝",
  PPTX: "📊",
  VIDEO: "🎬",
};

function LessonCard({
  lesson,
  onChanged,
  onDelete,
}: {
  lesson: LessonDto;
  onChanged: () => void;
  onDelete: () => void;
}) {
  const [addingMaterial, setAddingMaterial] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const { confirm, modal } = useConfirmModal();
  const { showToast } = useToast();

  async function addMaterial(type: string, title: string, url: string): Promise<string | null> {
    const res = await fetch(`/api/lessons/${lesson.id}/materials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, title, url }),
    });
    if (!res.ok) return readApiError(res, "Could not add the material. Try again.");
    setAddingMaterial(false);
    onChanged();
    return null;
  }

  async function updateMaterial(materialId: string, type: string, title: string, url: string): Promise<string | null> {
    const res = await fetch(`/api/materials/${materialId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, title, url }),
    });
    if (!res.ok) return readApiError(res, "Could not save. Try again.");
    setEditingMaterialId(null);
    onChanged();
    return null;
  }

  async function updateLesson(title: string, description: string): Promise<string | null> {
    const res = await fetch(`/api/lessons/${lesson.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });
    if (!res.ok) return readApiError(res, "Could not save. Try again.");
    setEditing(false);
    onChanged();
    return null;
  }

  async function deleteMaterial(materialId: string) {
    // audit finding #5 — was missing a confirm entirely
    const ok = await confirm({
      title: "Remove this material?",
      description: "This can't be undone.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/materials/${materialId}`, { method: "DELETE" });
    if (!res.ok) {
      showToast(await readApiError(res, "Could not remove the material. Try again."), "error");
      return;
    }
    showToast("Material removed.", "success");
    onChanged();
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-brand-gray bg-white dark:bg-brand-surface p-3">
        <AddForm
          fields={["title", "description"]}
          initialTitle={lesson.title}
          initialDescription={lesson.description ?? ""}
          submitLabel="Save"
          onCancel={() => setEditing(false)}
          onSubmit={(v) => updateLesson(v.title, v.description)}
        />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-brand-gray bg-white dark:bg-brand-surface p-3">
      {modal}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-900">{lesson.title}</div>
          {lesson.description && <div className="text-xs text-gray-600">{lesson.description}</div>}
        </div>
        <div className="flex shrink-0 gap-3">
          <button onClick={() => setEditing(true)} className="text-xs font-semibold text-brand-teal hover:underline">
            Edit
          </button>
          <button onClick={onDelete} className="text-xs font-semibold text-brand-rose hover:underline">
            Delete
          </button>
        </div>
      </div>

      {lesson.materials.length > 0 && (
        <ul className="mt-2 space-y-1">
          {lesson.materials.map((m) =>
            editingMaterialId === m.id ? (
              <li key={m.id}>
                <MaterialForm
                  initialType={m.type}
                  initialTitle={m.title}
                  initialUrl={m.url}
                  submitLabel="Save"
                  onCancel={() => setEditingMaterialId(null)}
                  onSubmit={(type, title, url) => updateMaterial(m.id, type, title, url)}
                />
              </li>
            ) : (
              <li key={m.id} className="flex flex-col gap-1 rounded bg-brand-mint/50 px-2 py-1.5 text-xs sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:py-1">
                <span>
                  {MATERIAL_ICON[m.type]} {m.title}{" "}
                  <span className="text-gray-500">({m.type}{m.type === "VIDEO" ? " — YouTube" : ""})</span>
                </span>
                <span className="flex shrink-0 gap-2">
                  <button onClick={() => setEditingMaterialId(m.id)} className="font-semibold text-brand-teal hover:underline">
                    Edit
                  </button>
                  <button onClick={() => deleteMaterial(m.id)} className="font-semibold text-brand-rose hover:underline">
                    Remove
                  </button>
                </span>
              </li>
            )
          )}
        </ul>
      )}

      <div className="mt-2">
        {addingMaterial ? (
          <MaterialForm onCancel={() => setAddingMaterial(false)} onSubmit={addMaterial} />
        ) : (
          <button
            onClick={() => setAddingMaterial(true)}
            className="text-xs font-semibold text-brand-teal hover:underline"
          >
            + Add Material
          </button>
        )}
      </div>
    </div>
  );
}

function MaterialForm({
  initialType = "PDF",
  initialTitle = "",
  initialUrl = "",
  submitLabel = "Add",
  onCancel,
  onSubmit,
}: {
  initialType?: string;
  initialTitle?: string;
  initialUrl?: string;
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: (type: string, title: string, url: string) => Promise<string | null>;
}) {
  const [type, setType] = useState(initialType);
  const [title, setTitle] = useState(initialTitle);
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-brand-gray bg-gray-50 p-3">
      <div className="flex gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded border border-brand-gray px-2 py-1.5 text-xs"
        >
          <option value="PDF">PDF</option>
          <option value="DOCX">DOCX</option>
          <option value="PPTX">PPTX</option>
          <option value="VIDEO">Video (YouTube link)</option>
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Material title"
          aria-label="Material title"
          className="flex-1 rounded border border-brand-gray px-2 py-1.5 text-xs"
        />
      </div>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={type === "VIDEO" ? "https://youtube.com/watch?v=... (unlisted)" : "https://..."}
        className="w-full rounded border border-brand-gray px-2 py-1.5 text-xs"
      />
      {error && <p className="text-xs text-brand-rose">{error}</p>}
      <div className="flex gap-2">
        <button
          disabled={saving}
          onClick={async () => {
            if (!title.trim() || !url.trim()) {
              setError("Title and URL are both required.");
              return;
            }
            setSaving(true);
            const err = await onSubmit(type, title.trim(), url.trim());
            setSaving(false);
            if (err) setError(err);
          }}
          className="rounded-lg bg-brand-teal px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving..." : submitLabel}
        </button>
        <button onClick={onCancel} className="rounded border border-brand-gray px-3 py-1.5 text-xs">
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Small shared title+description add/edit form, used for the course,
 * every module, and every lesson. Pre-fill initialTitle/initialDescription
 * to use it as an edit form instead of a create form — same component,
 * same validation, same error handling either way. */
function AddForm({
  fields,
  initialTitle = "",
  initialDescription = "",
  submitLabel,
  onCancel,
  onSubmit,
}: {
  fields: ("title" | "description")[];
  initialTitle?: string;
  initialDescription?: string;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (values: { title: string; description: string }) => Promise<string | null>;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <div className="space-y-2 rounded-lg border border-brand-gray bg-white dark:bg-brand-surface p-3">
      {fields.includes("title") && (
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          aria-label="Title"
          className="w-full rounded border border-brand-gray px-2.5 py-1.5 text-sm"
          autoFocus
        />
      )}
      {fields.includes("description") && (
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          aria-label="Description (optional)"
          className="w-full rounded border border-brand-gray px-2.5 py-1.5 text-sm"
        />
      )}
      {error && <p className="text-xs text-brand-rose">{error}</p>}
      <div className="flex gap-2">
        <button
          disabled={saving}
          onClick={async () => {
            if (!title.trim()) {
              setError("A title is required.");
              return;
            }
            setSaving(true);
            const err = await onSubmit({ title: title.trim(), description: description.trim() });
            setSaving(false);
            if (err) setError(err);
          }}
          className="rounded-lg bg-brand-teal px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving..." : submitLabel}
        </button>
        <button onClick={onCancel} className="rounded border border-brand-gray px-3 py-1.5 text-xs">
          Cancel
        </button>
      </div>
    </div>
  );
}
