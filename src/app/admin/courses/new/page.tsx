"use client";
import { useEffect, useState } from "react";
import StickyActions from "@/components/ui/StickyActions";
import DesktopRecommended from "@/components/pwa/DesktopRecommended";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { ADMIN_NAV } from "@/lib/admin/nav";

import { Checkbox, Input, Select, Textarea } from "@/components/ui/Field";
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
  const [discountPercent, setDiscountPercent] = useState("");
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
    const discountPercentValue = isFree || discountPercent.trim() === "" ? null : Number(discountPercent);
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
        discountPercent: discountPercentValue,
        accessModel: isFree ? "RECURRING_SUBSCRIPTION" : accessModel,
        billingInterval: !isFree && accessModel === "RECURRING_SUBSCRIPTION" ? billingInterval : null,
        accessDurationValue:
          !isFree && accessModel === "FIXED_DURATION" && durationUnit !== "LIFETIME" && durationValue.trim() !== ""
            ? Number(durationValue)
            : null,
        accessDurationUnit: !isFree && accessModel === "FIXED_DURATION" ? durationUnit : null,
        reminderEnabled: !isFree ? reminderEnabled : false,
        reminderDaysBeforeExpiry: !isFree && reminderEnabled ? parsedReminderDays : undefined,
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
        nav={ADMIN_NAV}
        right={<LogoutButton />}
      />
      <main className="mx-auto max-w-xl px-6 py-10">
        <DesktopRecommended what="Creating a course" />
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Create Course</h1>
        <Card className="mt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input label="Course Title" id="new-course-title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Excel for Data Analytics" />
            <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />

            <div className="rounded-lg border border-brand-gray bg-gray-50 p-4">
              <Checkbox label="This course is free (lifetime access, no payment)" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />

              {!isFree && (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap gap-3">
                    <Input label="Price (₦)" compact wrapperClassName="max-w-[10rem]" type="number" min={1} value={priceNaira} onChange={(e) => setPriceNaira(e.target.value)} placeholder="e.g. 50000" />
                    <Input label="Discount (%, optional)" compact wrapperClassName="max-w-[8rem]" type="number" min={1} max={99} value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} placeholder="e.g. 20" />
                  </div>
                  {priceNaira.trim() !== "" && discountPercent.trim() !== "" && Number(discountPercent) > 0 && (
                    <p className="text-xs text-gray-500">
                      Trainees will see{" "}
                      <span className="font-semibold text-brand-tealDeep">
                        ₦{Math.round(Number(priceNaira) * (1 - Number(discountPercent) / 100)).toLocaleString()}
                      </span>{" "}
                      <span className="line-through">₦{Number(priceNaira).toLocaleString()}</span> — a{" "}
                      <span className="font-semibold">-{discountPercent}% OFF</span> badge.
                    </p>
                  )}

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
                    <Select label="Billing interval" compact wrapperClassName="max-w-[10rem]" value={billingInterval} onChange={(e) => setBillingInterval(e.target.value as "MONTHLY" | "QUARTERLY" | "ANNUALLY")}>
                        <option value="MONTHLY">Monthly</option>
                        <option value="QUARTERLY">Quarterly</option>
                        <option value="ANNUALLY">Annually</option>
                      </Select>
                  ) : (
                    <>
                      <div className="flex items-end gap-2">
                        {durationUnit !== "LIFETIME" && (
                          <Input label="Duration" compact wrapperClassName="max-w-[8rem]" type="number" min={1} value={durationValue} onChange={(e) => setDurationValue(e.target.value)} placeholder="e.g. 90" />
                        )}
                        <Select label="Unit" compact wrapperClassName="max-w-[9rem]" value={durationUnit} onChange={(e) => setDurationUnit(e.target.value as "DAYS" | "MONTHS" | "LIFETIME")}>
                            <option value="DAYS">Days</option>
                            <option value="MONTHS">Months</option>
                            <option value="LIFETIME">Lifetime</option>
                          </Select>
                      </div>

                    </>
                  )}

                  <Checkbox label={<>{accessModel === "RECURRING_SUBSCRIPTION"
                      ? "Email trainees before their subscription automatically renews"
                      : "Email trainees before their access expires"}</>} checked={reminderEnabled} onChange={(e) => setReminderEnabled(e.target.checked)} />
                  {reminderEnabled && (
                    <label className="block text-sm text-brand-ink">
                      Days before {accessModel === "RECURRING_SUBSCRIPTION" ? "renewal" : "expiry"} to remind (comma-separated)
                      <Input label="e.g. 14, 7, 1" hideLabel compact wrapperClassName="max-w-[16rem]" value={reminderDays} onChange={(e) => setReminderDays(e.target.value)} placeholder="e.g. 14, 7, 1" />
                    </label>
                  )}
                </div>
              )}
            </div>

            {error && <p className="text-sm text-brand-rose">{error}</p>}
            <StickyActions>
              <Button type="submit" loading={loading} className="w-full">
                {loading ? "Creating..." : "Create & Add Modules"}
              </Button>
            </StickyActions>
          </form>
        </Card>
      </main>
    </>
  );
}
