"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";

interface ReviewDto {
  id: string;
  rating: number;
  reviewText: string | null;
  createdAt: string;
  traineeName: string;
  courseTitle: string;
  alreadyPromoted: boolean;
}
interface TestimonialDto {
  id: string;
  traineeName: string;
  quote: string;
  rating: number | null;
  courseTitle: string | null;
  published: boolean;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ color: "#d4a017" }}>
      {"★".repeat(rating)}
      <span style={{ color: "#d1d5db" }}>{"★".repeat(5 - rating)}</span>
    </span>
  );
}

/**
 * The real connection point between real trainee feedback and the
 * public landing page — reviews on one side, testimonials on the
 * other, with a single "promote" action linking them, matching the
 * design proposed and confirmed before building any of this.
 */
export default function AdminTestimonialsPage() {
  const [reviews, setReviews] = useState<ReviewDto[] | null>(null);
  const [testimonials, setTestimonials] = useState<TestimonialDto[] | null>(null);
  const [reviewsError, setReviewsError] = useState(false);
  const [testimonialsError, setTestimonialsError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualQuote, setManualQuote] = useState("");
  const [manualCourse, setManualCourse] = useState("");
  const { showToast } = useToast();

  function load() {
    setReviewsError(false);
    setTestimonialsError(false);
    fetch("/api/admin/course-reviews")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setReviews)
      .catch(() => setReviewsError(true));
    fetch("/api/admin/testimonials")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setTestimonials)
      .catch(() => setTestimonialsError(true));
  }

  useEffect(() => {
    load();
  }, []);

  async function promote(reviewId: string) {
    setBusyId(reviewId);
    const res = await fetch(`/api/admin/course-reviews/${reviewId}/promote`, { method: "POST" });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not promote. Try again.", "error");
      return;
    }
    showToast("Promoted to testimonial.");
    load();
  }

  async function togglePublished(id: string, published: boolean) {
    setBusyId(id);
    const res = await fetch(`/api/admin/testimonials/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !published }),
    });
    setBusyId(null);
    if (!res.ok) {
      showToast("Could not update. Try again.", "error");
      return;
    }
    load();
  }

  async function deleteTestimonial(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/admin/testimonials/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      showToast("Could not delete. Try again.", "error");
      return;
    }
    showToast("Deleted.");
    load();
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/testimonials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ traineeName: manualName, quote: manualQuote, courseTitle: manualCourse || undefined }),
    });
    if (!res.ok) {
      showToast("Could not save. Try again.", "error");
      return;
    }
    setManualName("");
    setManualQuote("");
    setManualCourse("");
    setShowManualForm(false);
    showToast("Testimonial added.");
    load();
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
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Testimonials</h1>

        <h2 className="mt-6 text-sm font-semibold text-gray-500">Course Reviews</h2>
        <div className="mt-2 space-y-3">
          {reviewsError ? (
            <ErrorState message="We couldn't load reviews." onRetry={load} />
          ) : reviews === null ? (
            <SkeletonList />
          ) : reviews.length === 0 ? (
            <p className="text-sm text-gray-500">No reviews yet.</p>
          ) : (
            reviews.map((r) => (
              <Card key={r.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-display font-semibold text-brand-ink">{r.traineeName}</p>
                    <p className="text-xs text-gray-500">{r.courseTitle}</p>
                    <p className="mt-1">
                      <Stars rating={r.rating} />
                    </p>
                    {r.reviewText && <p className="mt-1.5 text-sm text-gray-700">{r.reviewText}</p>}
                  </div>
                  {r.alreadyPromoted ? (
                    <span className="shrink-0 text-xs font-semibold text-brand-teal">✓ Promoted</span>
                  ) : r.reviewText ? (
                    <Button size="sm" onClick={() => promote(r.id)} loading={busyId === r.id} className="shrink-0">
                      Promote
                    </Button>
                  ) : null}
                </div>
              </Card>
            ))
          )}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-500">Testimonials</h2>
          {!showManualForm && (
            <button onClick={() => setShowManualForm(true)} className="text-xs font-semibold text-brand-teal hover:underline">
              + Add manually
            </button>
          )}
        </div>

        {showManualForm && (
          <Card className="mt-2">
            <form onSubmit={submitManual} className="space-y-2">
              <input
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Trainee name"
                aria-label="Trainee name"
                required
                className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
              />
              <input
                value={manualCourse}
                onChange={(e) => setManualCourse(e.target.value)}
                placeholder="Course (optional)"
                aria-label="Course (optional)"
                className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
              />
              <textarea
                value={manualQuote}
                onChange={(e) => setManualQuote(e.target.value)}
                placeholder="Quote"
                aria-label="Quote"
                rows={2}
                required
                className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
              />
              <div className="flex gap-2">
                <Button type="submit" size="sm">
                  Save
                </Button>
                <button
                  type="button"
                  onClick={() => setShowManualForm(false)}
                  className="text-xs font-semibold text-gray-500"
                >
                  Cancel
                </button>
              </div>
            </form>
          </Card>
        )}

        <div className="mt-2 space-y-3">
          {testimonialsError ? (
            <ErrorState message="We couldn't load testimonials." onRetry={load} />
          ) : testimonials === null ? (
            <SkeletonList />
          ) : testimonials.length === 0 ? (
            <p className="text-sm text-gray-500">No testimonials yet.</p>
          ) : (
            testimonials.map((t) => (
              <Card key={t.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-display font-semibold text-brand-ink">{t.traineeName}</p>
                    {t.courseTitle && <p className="text-xs text-gray-500">{t.courseTitle}</p>}
                    {t.rating && (
                      <p className="mt-1">
                        <Stars rating={t.rating} />
                      </p>
                    )}
                    <p className="mt-1.5 text-sm text-gray-700">{t.quote}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <button
                      onClick={() => togglePublished(t.id, t.published)}
                      disabled={busyId === t.id}
                      className={`text-xs font-semibold ${t.published ? "text-brand-teal" : "text-gray-400"}`}
                    >
                      {t.published ? "Published" : "Unpublished"}
                    </button>
                    <button
                      onClick={() => deleteTestimonial(t.id)}
                      disabled={busyId === t.id}
                      className="text-xs font-semibold text-brand-rose hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </main>
    </>
  );
}
