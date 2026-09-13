"use client";
import { useState } from "react";
import CourseFlyerUpload from "@/components/admin/CourseFlyerUpload";
import CourseCurriculumUpload from "@/components/admin/CourseCurriculumUpload";
import Toggle from "@/components/ui/Toggle";

export interface CourseMarketingFields {
  category: string | null;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null;
  durationDisplay: string | null;
  trainingFormat: "SELF_PACED" | "INSTRUCTOR_LED" | "HYBRID" | null;
  instructorNames: string | null;
  prerequisites: string[];
  targetAudience: string | null;
  skillsGained: string[];
  learningOutcomes: string[];
  whatToExpect: string[];
  showWhatYoullLearn: boolean;
  showOutline: boolean;
  showWhatToExpect: boolean;
  showRequirements: boolean;
  showAudience: boolean;
  showCurriculumDownload: boolean;
  showFlyer: boolean;
  flyerUrl: string | null;
  curriculumUrl: string | null;
  curriculumUploadedAt: string | null;
}

/**
 * Course catalogue upgrade — the "Course Information & Marketing
 * Materials" section. A deliberate, explained departure from this
 * file's own "every settings block lives inline in page.tsx"
 * convention: this block is genuinely larger (5 text fields, 2 enum
 * selects, 4 list editors, 7 toggles, 2 uploads) than any existing
 * settings block, and it's a genuinely different concern (content/copy
 * for prospective trainees) from every existing billing/access/
 * moderation block on this page. `page.tsx` itself only grows by one
 * import and one JSX line to render this, the same footprint as every
 * other settings block.
 *
 * Unlike ReminderSettings/PricingSettings's own hidden-until-"Edit"-
 * click pattern, this renders as an always-open form — it's
 * fundamentally a content-authoring panel, not a quick toggle, so
 * hiding it behind an extra click would just be friction for the
 * thing an admin came to this page to do.
 */
export default function CourseMarketingSettings({
  courseId,
  course,
  onSave,
  onChanged,
  showToast,
}: {
  courseId: string;
  course: CourseMarketingFields;
  onSave: (fields: Partial<CourseMarketingFields>) => Promise<string | null>;
  onChanged: () => void;
  showToast: (message: string, variant?: "success" | "error") => void;
}) {
  const [category, setCategory] = useState(course.category ?? "");
  const [level, setLevel] = useState(course.level ?? "");
  const [durationDisplay, setDurationDisplay] = useState(course.durationDisplay ?? "");
  const [trainingFormat, setTrainingFormat] = useState(course.trainingFormat ?? "");
  const [instructorNames, setInstructorNames] = useState(course.instructorNames ?? "");
  const [prerequisites, setPrerequisites] = useState(course.prerequisites.join("\n"));
  const [targetAudience, setTargetAudience] = useState(course.targetAudience ?? "");
  const [skillsGained, setSkillsGained] = useState(course.skillsGained.join("\n"));
  const [learningOutcomes, setLearningOutcomes] = useState(course.learningOutcomes.join("\n"));
  const [whatToExpect, setWhatToExpect] = useState(course.whatToExpect.join("\n"));
  const [saving, setSaving] = useState(false);

  function linesToList(value: string): string[] {
    return value
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }

  async function handleSave() {
    setSaving(true);
    const err = await onSave({
      category: category.trim() || null,
      level: (level || null) as CourseMarketingFields["level"],
      durationDisplay: durationDisplay.trim() || null,
      trainingFormat: (trainingFormat || null) as CourseMarketingFields["trainingFormat"],
      instructorNames: instructorNames.trim() || null,
      prerequisites: linesToList(prerequisites),
      targetAudience: targetAudience.trim() || null,
      skillsGained: linesToList(skillsGained),
      learningOutcomes: linesToList(learningOutcomes),
      whatToExpect: linesToList(whatToExpect),
    });
    setSaving(false);
    if (err) {
      showToast(err, "error");
      return;
    }
    showToast("Course information saved.", "success");
  }

  async function toggleSection(field: keyof CourseMarketingFields, value: boolean) {
    const err = await onSave({ [field]: value } as Partial<CourseMarketingFields>);
    if (err) showToast(err, "error");
  }

  return (
    <div className="mt-4 rounded-lg border border-brand-gray bg-gray-50 p-4">
      <p className="text-sm font-semibold text-gray-900">📋 Course Information &amp; Marketing Materials</p>
      <p className="mt-1 text-xs text-gray-600">
        Shown on the public course page before a trainee enrolls — the fuller this is, the more a prospective trainee
        can evaluate the course up front.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-gray-700">
          Category
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Data Analytics"
            className="mt-1 w-full rounded-lg border border-brand-gray px-2 py-1.5 text-sm outline-none focus:border-brand-teal"
          />
        </label>
        <label className="block text-xs text-gray-700">
          Level
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as typeof level)}
            className="mt-1 w-full rounded-lg border border-brand-gray px-2 py-1.5 text-sm"
          >
            <option value="">Not specified</option>
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </select>
        </label>
        <label className="block text-xs text-gray-700">
          Duration
          <input
            value={durationDisplay}
            onChange={(e) => setDurationDisplay(e.target.value)}
            placeholder="e.g. 6 weeks, 3 hrs/week"
            className="mt-1 w-full rounded-lg border border-brand-gray px-2 py-1.5 text-sm outline-none focus:border-brand-teal"
          />
        </label>
        <label className="block text-xs text-gray-700">
          Training format
          <select
            value={trainingFormat}
            onChange={(e) => setTrainingFormat(e.target.value as typeof trainingFormat)}
            className="mt-1 w-full rounded-lg border border-brand-gray px-2 py-1.5 text-sm"
          >
            <option value="">Not specified</option>
            <option value="SELF_PACED">Self-paced / Online</option>
            <option value="INSTRUCTOR_LED">Instructor-led</option>
            <option value="HYBRID">Hybrid</option>
          </select>
        </label>
        <label className="block text-xs text-gray-700 sm:col-span-2">
          Instructor(s)
          <input
            value={instructorNames}
            onChange={(e) => setInstructorNames(e.target.value)}
            placeholder="e.g. Jane Doe, Senior Data Analyst"
            className="mt-1 w-full rounded-lg border border-brand-gray px-2 py-1.5 text-sm outline-none focus:border-brand-teal"
          />
        </label>
        <label className="block text-xs text-gray-700 sm:col-span-2">
          Who this course is for
          <textarea
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            rows={2}
            placeholder="Describe the intended audience"
            className="mt-1 w-full resize-none rounded-lg border border-brand-gray px-2 py-1.5 text-sm outline-none focus:border-brand-teal"
          />
        </label>
        <label className="block text-xs text-gray-700">
          Prerequisites (one per line)
          <textarea
            value={prerequisites}
            onChange={(e) => setPrerequisites(e.target.value)}
            rows={4}
            placeholder={"Basic computer literacy\nA laptop with internet access"}
            className="mt-1 w-full resize-none rounded-lg border border-brand-gray px-2 py-1.5 text-sm outline-none focus:border-brand-teal"
          />
        </label>
        <label className="block text-xs text-gray-700">
          Skills gained (one per line)
          <textarea
            value={skillsGained}
            onChange={(e) => setSkillsGained(e.target.value)}
            rows={4}
            placeholder={"Data cleaning\nPivot tables\nDashboard design"}
            className="mt-1 w-full resize-none rounded-lg border border-brand-gray px-2 py-1.5 text-sm outline-none focus:border-brand-teal"
          />
        </label>
        <label className="block text-xs text-gray-700">
          What you&apos;ll learn (one per line)
          <textarea
            value={learningOutcomes}
            onChange={(e) => setLearningOutcomes(e.target.value)}
            rows={4}
            placeholder={"Clean and prepare real datasets\nBuild interactive dashboards"}
            className="mt-1 w-full resize-none rounded-lg border border-brand-gray px-2 py-1.5 text-sm outline-none focus:border-brand-teal"
          />
        </label>
        <label className="block text-xs text-gray-700">
          What to expect (one per line)
          <textarea
            value={whatToExpect}
            onChange={(e) => setWhatToExpect(e.target.value)}
            rows={4}
            placeholder={"Instructor-led sessions\nHands-on projects\nA certificate on completion"}
            className="mt-1 w-full resize-none rounded-lg border border-brand-gray px-2 py-1.5 text-sm outline-none focus:border-brand-teal"
          />
        </label>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-brand-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save course information"}
        </button>
      </div>

      <div className="mt-6 grid gap-4 border-t border-brand-gray pt-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold text-gray-700">Course flyer</p>
          <CourseFlyerUpload courseId={courseId} flyerUrl={course.flyerUrl} onChange={onChanged} />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-gray-700">Course curriculum</p>
          <CourseCurriculumUpload
            courseId={courseId}
            curriculumUrl={course.curriculumUrl}
            curriculumUploadedAt={course.curriculumUploadedAt}
            onChange={onChanged}
          />
        </div>
      </div>

      <div className="mt-6 border-t border-brand-gray pt-4">
        <p className="mb-2 text-xs font-semibold text-gray-700">Visible on the public course page</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["showFlyer", "Course flyer"],
              ["showOutline", "Course outline"],
              ["showWhatYoullLearn", "What you'll learn"],
              ["showWhatToExpect", "What to expect"],
              ["showRequirements", "Prerequisites"],
              ["showAudience", "Who this is for"],
              ["showCurriculumDownload", "Curriculum download"],
            ] as [keyof CourseMarketingFields, string][]
          ).map(([field, label]) => (
            <label key={field} className="flex items-center justify-between gap-2 text-xs text-gray-700">
              {label}
              <Toggle checked={course[field] as boolean} onChange={(v) => toggleSection(field, v)} />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
