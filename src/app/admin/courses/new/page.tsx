"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export default function NewCoursePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // Course enrollment/subscription system — every new course starts
  // free by default (matching the schema's own Course.isFree default),
  // so creating a course with none of these fields touched behaves
  // exactly as it always has.
  const [isFree, setIsFree] = useState(true);
  const [priceNaira, setPriceNaira] = useState("");
  const [accessModel, setAccessModel] = useState<"RECURRING_SUBSCRIPTION" | "FIXED_DURATION">("RECURRING_SUBSCRIPTION");
  const [billingInterval, setBillingInterval] = useState<"MONTHLY" | "QUARTERLY" | "ANNUALLY">("MONTHLY");
  const [durationValue, setDurationValue] = useState("");
  const [durationUnit, setDurationUnit] = useState<"DAYS" | "MONTHS" | "LIFETIME">("DAYS");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  // Settings-page redesign — "7, 3, 1" is only the initial fallback,
  // used until (and unless) the platform-wide default loads below; a
  // SUPER_ADMIN can change that default on the Payments settings tab.
  // Silently ignored for ADMIN/INSTRUCTOR (that endpoint is
  // SUPER_ADMIN-only) — they simply keep this same fallback, exactly
  // the behavior this page always had before the setting existed.
  const [reminderDays, setReminderDays] = useState("7, 3, 1");
  const [comingSoon, setComingSoon] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [estimatedDuration, setEstimatedDuration] = useState("");
  const [objectivesText, setObjectivesText] = useState("");
  const [benefitsText, setBenefitsText] = useState("");
  const [prerequisites, setPrerequisites] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/platform-settings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (Array.isArray(data.defaultReminderDaysBeforeExpiry)) {
          setReminderDays(data.defaultReminderDaysBeforeExpiry.join(", "));
        }
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const priceKobo = isFree || priceNaira.trim() === "" ? null : Math.round(Number(priceNaira) * 100);
    const parsedReminderDays = reminderDays
      .split(",")
      .map((d) => d.trim())
      .filter((d) => d !== "")
      .map(Number);

    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        isFree,
        priceKobo,
        accessModel: isFree ? "RECURRING_SUBSCRIPTION" : accessModel,
        billingInterval: !isFree && accessModel === "RECURRING_SUBSCRIPTION" ? billingInterval : null,
        accessDurationValue:
          !isFree && accessModel === "FIXED_DURATION" && durationUnit !== "LIFETIME" && durationValue.trim() !== ""
            ? Number(durationValue)
            : null,
        accessDurationUnit: !isFree && accessModel === "FIXED_DURATION" ? durationUnit : null,
        reminderEnabled: !isFree && accessModel === "FIXED_DURATION" ? reminderEnabled : false,
        reminderDaysBeforeExpiry: !isFree && accessModel === "FIXED_DURATION" && reminderEnabled ? parsedReminderDays : undefined,
        comingSoon,
        imageUrl: imageUrl.trim() || null,
        estimatedDuration: estimatedDuration.trim() || null,
        prerequisites: prerequisites.trim() || null,
        objectives: objectivesText.split("\n").map((s) => s.trim()).filter(Boolean),
        benefits: benefitsText.split("\n").map((s) => s.trim()).filter(Boolean),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      let message = "Could not create the course. Check the title and try again.";
      try {
        const body = await res.json();
        if (typeof body?.error === "string") message = body.error;
      } catch {}
      setError(message);
      return;
    }
    const course = await res.json();
    router.push(`/admin/courses/${course.id}`);
  }

  return (
    <>
      <SiteHeader
        nav={[
          { label: "Examinations", href: "/admin/dashboard" },
          { label: "Courses", href: "/admin/courses" },
          { label: "My Profile", href: "/admin/profile" },
          { label: "Settings", href: "/admin/settings" },
        ]}
        right={<LogoutButton />}
      />
      <main className="mx-auto max-w-xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Create Course</h1>
        <Card className="mt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="new-course-title" className="mb-1 block text-sm font-semibold text-brand-ink">
                Course Title
              </label>
              <input
                id="new-course-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Excel for Data Analytics"
                className="w-full rounded-lg border border-brand-gray px-3 py-2.5 outline-none focus:border-brand-teal"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-brand-ink">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-brand-gray px-3 py-2.5 outline-none focus:border-brand-teal"
              />
            </div>

            <div className="rounded-lg border border-brand-gray bg-gray-50 p-4 space-y-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
                <input type="checkbox" checked={comingSoon} onChange={(e) => setComingSoon(e.target.checked)} />
                Mark as "Coming Soon" (display on marketplace, disable enrollment)
              </label>

              <label className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
                <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />
                This course is free (lifetime access, no payment)
              </label>

              {!isFree && (
                <div className="mt-3 space-y-3">
                  <label className="block text-sm text-brand-ink">
                    Price (₦)
                    <input
                      type="number"
                      min={1}
                      value={priceNaira}
                      onChange={(e) => setPriceNaira(e.target.value)}
                      placeholder="e.g. 50000"
                      className="mt-1 w-full max-w-[10rem] rounded-lg border border-brand-gray px-2 py-1.5 text-sm outline-none focus:border-brand-teal"
                    />
                  </label>

                  <div className="flex gap-4 text-sm text-brand-ink">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        checked={accessModel === "RECURRING_SUBSCRIPTION"}
                        onChange={() => setAccessModel("RECURRING_SUBSCRIPTION")}
                      />
                      Recurring subscription
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        checked={accessModel === "FIXED_DURATION"}
                        onChange={() => setAccessModel("FIXED_DURATION")}
                      />
                      Fixed-duration access
                    </label>
                  </div>

                  {accessModel === "RECURRING_SUBSCRIPTION" ? (
                    <label className="block text-sm text-brand-ink">
                      Billing interval
                      <select
                        value={billingInterval}
                        onChange={(e) => setBillingInterval(e.target.value as "MONTHLY" | "QUARTERLY" | "ANNUALLY")}
                        className="mt-1 block w-full max-w-[10rem] rounded-lg border border-brand-gray px-2 py-1.5 text-sm outline-none focus:border-brand-teal"
                      >
                        <option value="MONTHLY">Monthly</option>
                        <option value="QUARTERLY">Quarterly</option>
                        <option value="ANNUALLY">Annually</option>
                      </select>
                    </label>
                  ) : (
                    <>
                      <div className="flex items-end gap-2">
                        {durationUnit !== "LIFETIME" && (
                          <label className="block text-sm text-brand-ink">
                            Duration
                            <input
                              type="number"
                              min={1}
                              value={durationValue}
                              onChange={(e) => setDurationValue(e.target.value)}
                              placeholder="e.g. 90"
                              className="mt-1 w-full max-w-[8rem] rounded-lg border border-brand-gray px-2 py-1.5 text-sm outline-none focus:border-brand-teal"
                            />
                          </label>
                        )}
                        <label className="block text-sm text-brand-ink">
                          Unit
                          <select
                            value={durationUnit}
                            onChange={(e) => setDurationUnit(e.target.value as "DAYS" | "MONTHS" | "LIFETIME")}
                            className="mt-1 block w-full max-w-[9rem] rounded-lg border border-brand-gray px-2 py-1.5 text-sm outline-none focus:border-brand-teal"
                          >
                            <option value="DAYS">Days</option>
                            <option value="MONTHS">Months</option>
                            <option value="LIFETIME">Lifetime</option>
                          </select>
                        </label>
                      </div>

                      <label className="flex items-center gap-2 text-sm text-brand-ink">
                        <input type="checkbox" checked={reminderEnabled} onChange={(e) => setReminderEnabled(e.target.checked)} />
                        Email trainees before their access expires
                      </label>
                      {reminderEnabled && (
                        <label className="block text-sm text-brand-ink">
                          Days before expiry to remind (comma-separated)
                          <input
                            value={reminderDays}
                            onChange={(e) => setReminderDays(e.target.value)}
                            placeholder="e.g. 14, 7, 1"
                            className="mt-1 w-full max-w-[16rem] rounded-lg border border-brand-gray px-2 py-1.5 text-sm outline-none focus:border-brand-teal"
                          />
                        </label>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Marketing Fields */}
            <div className="space-y-4 border-t border-brand-gray pt-4">
              <h2 className="font-display text-sm font-semibold text-brand-ink">Marketplace & Course Details</h2>

              <div>
                <label className="mb-1 block text-xs font-semibold text-brand-ink">Course Cover Image URL</label>
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-brand-ink">Estimated Duration</label>
                <input
                  value={estimatedDuration}
                  onChange={(e) => setEstimatedDuration(e.target.value)}
                  placeholder="e.g. 6 Weeks (Self-paced)"
                  className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-brand-ink">Prerequisites / Requirements</label>
                <input
                  value={prerequisites}
                  onChange={(e) => setPrerequisites(e.target.value)}
                  placeholder="e.g. Basic understanding of web development"
                  className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-brand-ink">Learning Objectives (One per line)</label>
                <textarea
                  value={objectivesText}
                  onChange={(e) => setObjectivesText(e.target.value)}
                  placeholder="Master React fundamentals&#10;Build REST APIs with Node.js"
                  rows={3}
                  className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-brand-ink">Course Benefits (One per line)</label>
                <textarea
                  value={benefitsText}
                  onChange={(e) => setBenefitsText(e.target.value)}
                  placeholder="Hands-on portfolio projects&#10;Verified digital certificate"
                  rows={3}
                  className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
                />
              </div>
            </div>

            {error && <p className="text-sm text-brand-rose">{error}</p>}
            <Button type="submit" loading={loading} className="w-full">
              {loading ? "Creating..." : "Create & Add Modules"}
            </Button>
          </form>
        </Card>
      </main>
    </>
  );
}
