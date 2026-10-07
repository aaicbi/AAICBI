"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import BackLink from "@/components/ui/BackLink";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { useConfirmModal } from "@/components/ui/useConfirmModal";
import { ADMIN_NAV_STAFF } from "@/lib/admin/nav";

import { Input, Select } from "@/components/ui/Field";
interface AgreementDto {
  id: string;
  status: "PENDING" | "ACCEPTED";
  content: string;
  sentAt: string;
  sentBy: { name: string };
  acceptedAt: string | null;
  acceptedName: string | null;
  acceptedIp: string | null;
  monthlyCompensationKobo: number | null;
  effectiveDate: string;
}
interface CourseDto {
  id: string;
  title: string;
  status: string;
  payoutType: "PERCENTAGE_OF_REVENUE" | "FLAT_PER_SUBSCRIBER" | null;
  payoutPercentage: number | null;
  payoutFlatRateKobo: number | null;
  payoutNotes: string | null;
}
interface InstructorDetail {
  id: string;
  name: string;
  email: string;
  active: boolean;
  createdAt: string;
  instructorAgreementsOwned: AgreementDto[];
  courses: CourseDto[];
}
interface TemplateOption {
  id: string;
  name: string;
  isActive: boolean;
}
interface CourseOption {
  id: string;
  title: string;
}

/**
 * /admin/instructors/[id] — the one place a Super Admin sends an
 * agreement, reviews its full archived history (every InstructorAgreement
 * row, each an immutable resolved snapshot — "content" — never edited
 * after the fact), and configures per-course payout.
 */
export default function InstructorDetailPage({ params }: { params: { id: string } }) {
  const { showToast } = useToast();
  const { confirm, modal } = useConfirmModal();
  const [instructor, setInstructor] = useState<InstructorDetail | null | undefined>(undefined);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [allCourses, setAllCourses] = useState<CourseOption[]>([]);
  const [expandedAgreementId, setExpandedAgreementId] = useState<string | null>(null);
  const [showSendForm, setShowSendForm] = useState(false);
  const [sending, setSending] = useState(false);
  const [payoutBusyId, setPayoutBusyId] = useState<string | null>(null);
  const [courseToAssign, setCourseToAssign] = useState("");
  const [assigning, setAssigning] = useState(false);

  const [form, setForm] = useState({
    templateId: "",
    instructorAddress: "",
    instructorPhone: "",
    position: "Instructor",
    courseDuration: "",
    effectiveDate: "",
    endDate: "",
    monthlyCompensationNaira: "",
    paymentFrequency: "Monthly",
    paymentDate: "",
    liveSessionDay: "",
    liveSessionTime: "",
    liveSessionPlatform: "",
    noticePeriodDays: "30",
  });

  const [payoutForm, setPayoutForm] = useState<
    Record<string, { payoutType: "PERCENTAGE_OF_REVENUE" | "FLAT_PER_SUBSCRIBER"; payoutPercentage: string; payoutFlatRateKobo: string; payoutNotes: string }>
  >({});

  function load() {
    fetch(`/api/admin/instructors/${params.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: InstructorDetail) => {
        setInstructor(data);
        const initialPayout: typeof payoutForm = {};
        for (const c of data.courses) {
          initialPayout[c.id] = {
            payoutType: c.payoutType ?? "PERCENTAGE_OF_REVENUE",
            payoutPercentage: c.payoutPercentage != null ? String(c.payoutPercentage) : "",
            payoutFlatRateKobo: c.payoutFlatRateKobo != null ? String(c.payoutFlatRateKobo / 100) : "",
            payoutNotes: c.payoutNotes ?? "",
          };
        }
        setPayoutForm(initialPayout);
      })
      .catch(() => setInstructor(null));
    fetch("/api/admin/agreement-templates")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: TemplateOption[]) => setTemplates(data.filter((t) => t.isActive)))
      .catch(() => setTemplates([]));
    fetch("/api/courses")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: CourseOption[]) => setAllCourses(data))
      .catch(() => setAllCourses([]));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function toggleActive() {
    if (!instructor) return;
    await fetch(`/api/admin/instructors/${instructor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !instructor.active }),
    });
    load();
  }

  async function sendAgreement(e: React.FormEvent) {
    e.preventDefault();
    if (!instructor) return;
    setSending(true);
    const res = await fetch(`/api/admin/instructors/${instructor.id}/agreement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId: form.templateId,
        instructorAddress: form.instructorAddress || undefined,
        instructorPhone: form.instructorPhone || undefined,
        position: form.position || undefined,
        courseDuration: form.courseDuration || undefined,
        effectiveDate: form.effectiveDate ? new Date(form.effectiveDate).toISOString() : undefined,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
        monthlyCompensationKobo: form.monthlyCompensationNaira ? Math.round(parseFloat(form.monthlyCompensationNaira) * 100) : undefined,
        paymentFrequency: form.paymentFrequency || undefined,
        paymentDate: form.paymentDate || undefined,
        liveSessionDay: form.liveSessionDay || undefined,
        liveSessionTime: form.liveSessionTime || undefined,
        liveSessionPlatform: form.liveSessionPlatform || undefined,
        noticePeriodDays: form.noticePeriodDays ? parseInt(form.noticePeriodDays, 10) : undefined,
      }),
    });
    setSending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not send agreement.", "error");
      return;
    }
    showToast("Agreement sent — the instructor has been emailed.");
    setShowSendForm(false);
    load();
  }

  async function savePayout(courseId: string) {
    const f = payoutForm[courseId];
    if (!f) return;
    setPayoutBusyId(courseId);
    const res = await fetch(`/api/admin/courses/${courseId}/payout`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payoutType: f.payoutType,
        payoutPercentage: f.payoutType === "PERCENTAGE_OF_REVENUE" ? parseInt(f.payoutPercentage, 10) : undefined,
        payoutFlatRateKobo: f.payoutType === "FLAT_PER_SUBSCRIBER" ? Math.round(parseFloat(f.payoutFlatRateKobo) * 100) : undefined,
        payoutNotes: f.payoutNotes || undefined,
      }),
    });
    setPayoutBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not save payout.", "error");
      return;
    }
    showToast("Payout configuration saved.");
    load();
  }

  async function assignCourse() {
    if (!instructor || !courseToAssign) return;
    const ok = await confirm({
      title: "Assign this course?",
      description: "This replaces the current instructor of record for this course, if it has one — that instructor will stop seeing it in their portal.",
      confirmLabel: "Assign",
    });
    if (!ok) return;
    setAssigning(true);
    const res = await fetch(`/api/admin/instructors/${instructor.id}/courses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: courseToAssign }),
    });
    setAssigning(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not assign that course.", "error");
      return;
    }
    setCourseToAssign("");
    showToast("Course assigned — the instructor has been emailed.");
    load();
  }

  if (instructor === undefined) {
    return (
      <>
        <SiteHeader nav={ADMIN_NAV_STAFF} right={<LogoutButton />} />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <SkeletonList rows={4} />
        </main>
      </>
    );
  }
  if (instructor === null) {
    return (
      <>
        <SiteHeader nav={ADMIN_NAV_STAFF} right={<LogoutButton />} />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <EmptyState title="Instructor not found" />
        </main>
      </>
    );
  }

  const unassignedCourses = allCourses.filter((c) => !instructor.courses.some((ic) => ic.id === c.id));

  return (
    <>
      <SiteHeader nav={ADMIN_NAV_STAFF} right={<LogoutButton />} />
      {modal}
      <main className="mx-auto max-w-3xl px-6 py-10">
        <BackLink href="/admin/instructors" className="text-sm text-brand-teal hover:underline">
          Back to Instructors
        </BackLink>

        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-brand-ink">{instructor.name}</h1>
            <p className="text-sm text-gray-500">{instructor.email}</p>
          </div>
          <div className="flex items-center gap-2">
            {!instructor.active && <Badge variant="danger">Deactivated</Badge>}
            <button onClick={toggleActive} className="text-xs font-semibold text-gray-500 hover:text-brand-rose">
              {instructor.active ? "Deactivate" : "Reactivate"}
            </button>
          </div>
        </div>

        {/* Send Agreement */}
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-brand-ink">Agreement</h2>
            {!showSendForm && <Button size="sm" onClick={() => setShowSendForm(true)}>Send New Agreement</Button>}
          </div>

          {showSendForm && (
            <Card className="mt-3">
              <form onSubmit={sendAgreement} className="space-y-3">
                <div>
                  <Select label="Template" compact required value={form.templateId} onChange={(e) => setForm((f) => ({ ...f, templateId: e.target.value }))}>
                    <option value="">Select a template…</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                  {templates.length === 0 && (
                    <p className="mt-1 text-xs text-brand-rose">
                      No active templates yet — create one at{" "}
                      <a href="/admin/agreement-templates" className="underline">
                        Agreement Templates
                      </a>
                      .
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Position" value={form.position} onChange={(v) => setForm((f) => ({ ...f, position: v }))} placeholder="Instructor" />
                  <Field label="Course Duration" value={form.courseDuration} onChange={(v) => setForm((f) => ({ ...f, courseDuration: v }))} placeholder="e.g. 12 weeks" />
                  <Field label="Address" value={form.instructorAddress} onChange={(v) => setForm((f) => ({ ...f, instructorAddress: v }))} />
                  <Field label="Phone Number" value={form.instructorPhone} onChange={(v) => setForm((f) => ({ ...f, instructorPhone: v }))} />
                  <Field label="Expected Start Date" type="date" value={form.effectiveDate} onChange={(v) => setForm((f) => ({ ...f, effectiveDate: v }))} required />
                  <Field label="Expected End Date" type="date" value={form.endDate} onChange={(v) => setForm((f) => ({ ...f, endDate: v }))} />
                  <Field label="Remuneration (₦)" type="number" value={form.monthlyCompensationNaira} onChange={(v) => setForm((f) => ({ ...f, monthlyCompensationNaira: v }))} placeholder="100000" />
                  <Select label="Payment Schedule" compact value={form.paymentFrequency} onChange={(e) => setForm((f) => ({ ...f, paymentFrequency: e.target.value }))}>
                      <option value="Monthly">Monthly</option>
                      <option value="Milestone">Milestone</option>
                      <option value="Other">Other</option>
                    </Select>
                  <Field label="Payment Date / Arrangement" value={form.paymentDate} onChange={(v) => setForm((f) => ({ ...f, paymentDate: v }))} placeholder="e.g. 5th of every month" />
                  <Field label="Live Session Day" value={form.liveSessionDay} onChange={(v) => setForm((f) => ({ ...f, liveSessionDay: v }))} placeholder="e.g. Saturday" />
                  <Field label="Live Session Time" value={form.liveSessionTime} onChange={(v) => setForm((f) => ({ ...f, liveSessionTime: v }))} placeholder="e.g. 4:00 PM WAT" />
                  <Field label="Live Session Platform" value={form.liveSessionPlatform} onChange={(v) => setForm((f) => ({ ...f, liveSessionPlatform: v }))} placeholder="Google Meet" />
                  <Field label="Resignation Notice (days)" type="number" value={form.noticePeriodDays} onChange={(v) => setForm((f) => ({ ...f, noticePeriodDays: v }))} />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="submit" size="sm" loading={sending} disabled={templates.length === 0}>
                    Send Agreement
                  </Button>
                  <button type="button" onClick={() => setShowSendForm(false)} className="text-xs font-semibold text-gray-500">
                    Cancel
                  </button>
                </div>
              </form>
            </Card>
          )}

          <div className="mt-3 space-y-3">
            {instructor.instructorAgreementsOwned.length === 0 && (
              <p className="text-sm text-gray-500">No agreement sent yet.</p>
            )}
            {instructor.instructorAgreementsOwned.map((a) => (
              <Card key={a.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-brand-ink">Sent {new Date(a.sentAt).toLocaleString()} by {a.sentBy.name}</p>
                    {a.acceptedAt && (
                      <p className="text-xs text-gray-500">
                        Accepted {new Date(a.acceptedAt).toLocaleString()} — signed as "{a.acceptedName}" from {a.acceptedIp}
                      </p>
                    )}
                  </div>
                  {a.status === "ACCEPTED" ? <Badge variant="success">Accepted</Badge> : <Badge variant="warning">Pending</Badge>}
                </div>
                <button
                  onClick={() => setExpandedAgreementId(expandedAgreementId === a.id ? null : a.id)}
                  className="mt-2 text-xs font-semibold text-brand-teal hover:underline"
                >
                  {expandedAgreementId === a.id ? "Hide full agreement" : "View full agreement"}
                </button>
                {expandedAgreementId === a.id && (
                  <div className="mt-2 max-h-96 overflow-y-auto rounded-lg border border-brand-gray bg-brand-surface p-4 text-xs leading-relaxed whitespace-pre-wrap text-brand-ink">
                    {a.content}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </section>

        {/* Course assignment + payout configuration */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold text-brand-ink">Courses</h2>
          <p className="mt-1 text-sm text-gray-500">
            Assigning a course here sets this instructor as its instructor of record — that's what makes the course's materials,
            students, and payout appear in their Instructor Portal.
          </p>

          <Card className="mt-3">
            <div className="flex gap-2">
              <Select label="Course to assign" hideLabel compact wrapperClassName="flex-1" value={courseToAssign} onChange={(e) => setCourseToAssign(e.target.value)}>
                <option value="">Select a course to assign…</option>
                {unassignedCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
              <Button size="sm" onClick={assignCourse} loading={assigning} disabled={!courseToAssign}>
                Assign
              </Button>
            </div>
            {unassignedCourses.length === 0 && allCourses.length > 0 && (
              <p className="mt-2 text-xs text-gray-500">Every course you can manage is already assigned to this instructor.</p>
            )}
          </Card>

          <div className="mt-3 space-y-3">
            {instructor.courses.length === 0 && <p className="text-sm text-gray-500">No courses assigned yet.</p>}
            {instructor.courses.map((c) => {
              const f = payoutForm[c.id];
              if (!f) return null;
              return (
                <Card key={c.id}>
                  <p className="font-semibold text-brand-ink">{c.title}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Select label="Payout Type" compact value={f.payoutType} onChange={(e) =>
                          setPayoutForm((p) => ({ ...p, [c.id]: { ...p[c.id], payoutType: e.target.value as typeof f.payoutType } }))
                        }>
                        <option value="PERCENTAGE_OF_REVENUE">Percentage of Revenue</option>
                        <option value="FLAT_PER_SUBSCRIBER">Flat Rate per Subscriber</option>
                      </Select>
                    {f.payoutType === "PERCENTAGE_OF_REVENUE" ? (
                      <Field
                        label="Percentage (%)"
                        type="number"
                        value={f.payoutPercentage}
                        onChange={(v) => setPayoutForm((p) => ({ ...p, [c.id]: { ...p[c.id], payoutPercentage: v } }))}
                      />
                    ) : (
                      <Field
                        label="Flat Rate per Subscriber (₦)"
                        type="number"
                        value={f.payoutFlatRateKobo}
                        onChange={(v) => setPayoutForm((p) => ({ ...p, [c.id]: { ...p[c.id], payoutFlatRateKobo: v } }))}
                      />
                    )}
                  </div>
                  <div className="mt-3">
                    <Field label="Notes" value={f.payoutNotes} onChange={(v) => setPayoutForm((p) => ({ ...p, [c.id]: { ...p[c.id], payoutNotes: v } }))} />
                  </div>
                  <Button size="sm" className="mt-3" loading={payoutBusyId === c.id} onClick={() => savePayout(c.id)}>
                    Save Payout
                  </Button>
                </Card>
              );
            })}
          </div>
        </section>
      </main>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <Input
      label={label}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
    />
  );
}
