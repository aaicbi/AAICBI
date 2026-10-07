"use client";
import { useState } from "react";
import Icon from "@/components/ui/Icon";
import Badge from "@/components/ui/Badge";
import { CalendarClock } from "lucide-react";
import {
  getCourseLifecyclePhase,
  COURSE_LIFECYCLE_PHASE_LABEL,
  COURSE_LIFECYCLE_PHASE_BADGE_VARIANT,
} from "@/lib/courseLifecycle";

import { Input, Select } from "@/components/ui/Field";
export interface CourseScheduleFields {
  startDate: string | null;
  endDate: string | null;
  registrationDeadline: string | null;
  locationType: "PHYSICAL" | "ONLINE" | "HYBRID" | null;
  venue: string | null;
  capacity: number | null;
  lifecyclePhaseOverride: "COMING_SOON" | "REGISTRATION_OPEN" | "REGISTRATION_CLOSED" | "STARTED" | "COMPLETED" | null;
}

// datetime-local wants "YYYY-MM-DDTHH:mm" in the browser's own local
// time — an ISO string from the API (UTC) needs converting both ways,
// same round-trip every native date input in this app already needs.
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Coming Soon Courses — "Schedule & Registration," the new settings
 * panel copying CourseMarketingSettings.tsx's exact shape: always-open
 * (this is authoring, not a quick toggle), local useState per field,
 * one `handleSave` calling `onSave(partialFields)` -> the parent's
 * single `PUT /api/courses/{id}`.
 */
export default function CourseScheduleSettings({
  course,
  onSave,
  showToast,
}: {
  course: CourseScheduleFields;
  onSave: (fields: Partial<CourseScheduleFields>) => Promise<string | null>;
  showToast: (message: string, variant?: "success" | "error") => void;
}) {
  const [startDate, setStartDate] = useState(toLocalInputValue(course.startDate));
  const [endDate, setEndDate] = useState(toLocalInputValue(course.endDate));
  const [registrationDeadline, setRegistrationDeadline] = useState(toLocalInputValue(course.registrationDeadline));
  const [locationType, setLocationType] = useState(course.locationType ?? "");
  const [venue, setVenue] = useState(course.venue ?? "");
  const [capacity, setCapacity] = useState(course.capacity != null ? String(course.capacity) : "");
  const [lifecyclePhaseOverride, setLifecyclePhaseOverride] = useState(course.lifecyclePhaseOverride ?? "");
  const [saving, setSaving] = useState(false);

  const computedPhase = getCourseLifecyclePhase({
    startDate: startDate ? new Date(startDate).toISOString() : null,
    endDate: endDate ? new Date(endDate).toISOString() : null,
    registrationDeadline: registrationDeadline ? new Date(registrationDeadline).toISOString() : null,
    lifecyclePhaseOverride: (lifecyclePhaseOverride || null) as CourseScheduleFields["lifecyclePhaseOverride"],
  });

  async function handleSave() {
    setSaving(true);
    const err = await onSave({
      startDate: startDate ? new Date(startDate).toISOString() : null,
      endDate: endDate ? new Date(endDate).toISOString() : null,
      registrationDeadline: registrationDeadline ? new Date(registrationDeadline).toISOString() : null,
      locationType: (locationType || null) as CourseScheduleFields["locationType"],
      venue: venue.trim() || null,
      capacity: capacity.trim() ? Number(capacity) : null,
      lifecyclePhaseOverride: (lifecyclePhaseOverride || null) as CourseScheduleFields["lifecyclePhaseOverride"],
    });
    setSaving(false);
    if (err) {
      showToast(err, "error");
      return;
    }
    showToast("Schedule & registration saved.", "success");
  }

  return (
    <div className="mt-4 rounded-lg border border-brand-gray bg-gray-50 p-4">
      <p className="flex items-center gap-1 text-sm font-semibold text-gray-900">
        <Icon icon={CalendarClock} size="sm" /> Schedule &amp; Registration
      </p>
      <p className="mt-1 text-xs text-gray-600">
        Set these to advertise this course as coming soon. Leave everything blank for an ordinary course with no
        launch date.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Input label="Start date" compact type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <Input label="End date (optional)" compact type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <Input label="Registration deadline" compact type="datetime-local" value={registrationDeadline} onChange={(e) => setRegistrationDeadline(e.target.value)} />
        <Input label="Capacity (optional)" compact type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="e.g. 50" />
        <Select label="Location" compact value={locationType} onChange={(e) => setLocationType(e.target.value as typeof locationType)}>
            <option value="">Not specified</option>
            <option value="ONLINE">Online</option>
            <option value="PHYSICAL">Physical</option>
            <option value="HYBRID">Hybrid</option>
          </Select>
        {(locationType === "PHYSICAL" || locationType === "HYBRID") && (
          <Input label="Venue" compact value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. AAICBI Training Hall, Uyo" />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-brand-gray pt-4">
        <Select label="Status override" compact wrapperClassName="min-w-[220px]" value={lifecyclePhaseOverride} onChange={(e) => setLifecyclePhaseOverride(e.target.value as typeof lifecyclePhaseOverride)}>
            <option value="">Auto (computed from dates)</option>
            <option value="COMING_SOON">Coming Soon</option>
            <option value="REGISTRATION_OPEN">Registration Open</option>
            <option value="REGISTRATION_CLOSED">Registration Closed</option>
            <option value="STARTED">Started</option>
            <option value="COMPLETED">Completed</option>
          </Select>
        <div className="text-xs text-gray-600">
          <span className="mr-2">Visitors currently see:</span>
          {computedPhase ? (
            <Badge variant={COURSE_LIFECYCLE_PHASE_BADGE_VARIANT[computedPhase]}>
              {COURSE_LIFECYCLE_PHASE_LABEL[computedPhase]}
            </Badge>
          ) : (
            <Badge variant="neutral">Not a scheduled course</Badge>
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-brand-teal px-4 py-2 text-sm font-semibold text-brand-onAccent disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save schedule & registration"}
        </button>
      </div>
    </div>
  );
}
