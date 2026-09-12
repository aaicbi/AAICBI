"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

interface ModuleDto {
  id: string;
  title: string;
  description: string | null;
  lessons: { id: string; title: string; description: string | null }[];
}

interface CourseDetailDto {
  id: string;
  title: string;
  description: string | null;
  createdBy: { name: string };
  modules: ModuleDto[];
  isFree: boolean;
  priceKobo: number | null;
  billingInterval: string | null;
  comingSoon: boolean;
  imageUrl: string | null;
  objectives: string[];
  prerequisites: string | null;
  benefits: string[];
  estimatedDuration: string | null;
}

export default function PublicCourseDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [course, setCourse] = useState<CourseDetailDto | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ userId: string; role: string } | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.userId && data.role === "TRAINEE") {
          setCurrentUser(data);
        }
      })
      .catch(() => {});

    fetch(`/api/courses/${params.id}`)
      .then(async (r) => {
        if (r.status === 403) {
          const data = await r.json().catch(() => null);
          if (data?.course) {
            setCourse(data.course);
            return;
          }
        }
        if (!r.ok) {
          setNotFound(true);
          return;
        }
        const data = await r.json();
        setCourse(data);
      })
      .catch(() => setNotFound(true));
  }, [params.id]);

  async function handleEnroll() {
    if (course?.comingSoon) return;

    if (!currentUser) {
      router.push(`/trainee/register?redirect=/courses/${params.id}&action=enroll`);
      return;
    }

    setEnrolling(true);
    setErrorMsg(null);

    if (course?.isFree) {
      const res = await fetch(`/api/courses/${params.id}/enroll`, { method: "POST" });
      setEnrolling(false);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(typeof data.error === "string" ? data.error : "Could not enroll. Please try again.");
        return;
      }
      router.push(`/trainee/courses/${params.id}`);
      return;
    }

    if (typeof window !== "undefined" && !(window as unknown as { PaystackPop?: unknown }).PaystackPop) {
      await new Promise<void>((resolve) => {
        const script = document.createElement("script");
        script.src = "https://js.paystack.co/v1/inline.js";
        script.onload = () => resolve();
        script.onerror = () => resolve();
        document.body.appendChild(script);
      });
    }

    const res = await fetch(`/api/courses/${params.id}/pay`, { method: "POST" });
    setEnrolling(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(typeof data.error === "string" ? data.error : "Could not start payment.");
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
          router.push(`/trainee/courses/${params.id}`);
        },
        callback: () => {
          router.push(`/trainee/courses/${params.id}`);
        },
      };
      if (process.env.NEXT_PUBLIC_PAYSTACK_KEY) {
        paystackOptions.key = process.env.NEXT_PUBLIC_PAYSTACK_KEY;
      }
      const handler = PaystackPop.setup(paystackOptions);
      handler.openIframe();
    } else {
      window.location.href = data.authorizationUrl;
    }
  }

  if (notFound) {
    return (
      <>
        <SiteHeader
          nav={[
            { label: "Marketplace", href: "/courses" },
            { label: "Verify Certificate", href: "/certificate" },
          ]}
        />
        <main className="mx-auto max-w-2xl px-6 py-16 text-center">
          <Card>
            <h1 className="font-display text-xl font-semibold text-brand-ink">Course Not Found</h1>
            <p className="mt-2 text-sm text-gray-600">The requested training program is unavailable.</p>
            <Button href="/courses" className="mt-4">
              Browse Marketplace
            </Button>
          </Card>
        </main>
      </>
    );
  }

  if (!course) {
    return (
      <>
        <SiteHeader
          nav={[
            { label: "Marketplace", href: "/courses" },
            { label: "Verify Certificate", href: "/certificate" },
          ]}
        />
        <main className="mx-auto max-w-4xl px-6 py-16 text-center text-gray-500">
          Loading course details...
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader
        nav={[
          { label: "Marketplace", href: "/courses" },
          { label: "Verify Certificate", href: "/certificate" },
          { label: "Sign In", href: "/trainee/login" },
        ]}
        right={
          currentUser ? (
            <LogoutButton />
          ) : (
            <Button href="/trainee/register" size="sm">
              Get Started
            </Button>
          )
        }
      />
      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* Breadcrumb */}
        <div className="text-xs text-gray-500">
          <Link href="/courses" className="hover:underline text-brand-teal">
            Marketplace
          </Link>{" "}
          / <span className="text-gray-700">{course.title}</span>
        </div>

        {/* Hero Section */}
        <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              {course.comingSoon ? (
                <Badge variant="warning">COMING SOON</Badge>
              ) : course.isFree ? (
                <Badge variant="neutral">FREE</Badge>
              ) : (
                <Badge variant="success">PAID</Badge>
              )}
              {course.estimatedDuration && (
                <span className="text-xs text-gray-500">Duration: {course.estimatedDuration}</span>
              )}
            </div>

            <h1 className="mt-3 font-display text-3xl font-semibold text-brand-ink sm:text-4xl">
              {course.title}
            </h1>
            <p className="mt-2 text-xs text-gray-500">Instructed by {course.createdBy.name} · AAICBI</p>

            {course.description && (
              <p className="mt-4 text-sm leading-relaxed text-gray-700">{course.description}</p>
            )}

            {/* Course Objectives */}
            {course.objectives && course.objectives.length > 0 && (
              <Card className="mt-6 p-5">
                <h2 className="font-display text-lg font-semibold text-brand-ink">What You Will Learn</h2>
                <ul className="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-700 sm:grid-cols-2">
                  {course.objectives.map((obj, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-brand-teal font-semibold">✓</span>
                      <span>{obj}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* Course Benefits */}
            {course.benefits && course.benefits.length > 0 && (
              <Card className="mt-6 p-5">
                <h2 className="font-display text-lg font-semibold text-brand-ink">Course Benefits</h2>
                <ul className="mt-3 space-y-2 text-xs text-gray-700">
                  {course.benefits.map((b, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-brand-gold font-semibold">★</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* Course Outline / Modules */}
            <div className="mt-8">
              <h2 className="font-display text-xl font-semibold text-brand-ink">Course Outline</h2>
              <p className="mt-1 text-xs text-gray-500">Explore modules and lessons included in this training.</p>

              {course.modules && course.modules.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {course.modules.map((m, i) => (
                    <Card key={m.id} className="p-4">
                      <div className="font-display font-semibold text-brand-ink">
                        Module {i + 1}: {m.title}
                      </div>
                      {m.description && <p className="mt-1 text-xs text-gray-600">{m.description}</p>}

                      {m.lessons && m.lessons.length > 0 && (
                        <div className="mt-3 border-t border-brand-gray pt-2 space-y-1.5">
                          {m.lessons.map((l) => (
                            <div key={l.id} className="text-xs text-gray-700 flex items-center justify-between">
                              <span>• {l.title}</span>
                              <span className="text-[10px] text-gray-400">Lesson</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="mt-4 text-xs text-gray-500 text-center py-6">
                  Course outline modules will be listed here prior to start.
                </Card>
              )}
            </div>

            {/* Prerequisites & Certificate Info */}
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card className="p-4">
                <h3 className="font-display text-sm font-semibold text-brand-ink">Requirements</h3>
                <p className="mt-1 text-xs text-gray-600">
                  {course.prerequisites || "No specific prior experience required. Open to all motivated trainees."}
                </p>
              </Card>
              <Card className="p-4">
                <h3 className="font-display text-sm font-semibold text-brand-ink">Verifiable Certificate</h3>
                <p className="mt-1 text-xs text-gray-600">
                  Upon passing the course assessment, trainees earn an official AAICBI certificate with a public verification code.
                </p>
              </Card>
            </div>
          </div>

          {/* Sidebar CTA Card */}
          <div>
            <Card className="sticky top-6 p-6 shadow-sm">
              {course.imageUrl && (
                <div className="mb-4 h-48 w-full overflow-hidden rounded-lg bg-brand-sand">
                  <img src={course.imageUrl} alt={course.title} className="h-full w-full object-cover" />
                </div>
              )}

              <div className="text-center">
                {course.isFree ? (
                  <div className="font-display text-3xl font-semibold text-brand-teal">FREE</div>
                ) : (
                  <div className="font-display text-3xl font-semibold text-brand-ink">
                    ₦{((course.priceKobo ?? 0) / 100).toLocaleString()}
                    {course.billingInterval && (
                      <span className="text-xs font-normal text-gray-500">/{course.billingInterval.toLowerCase()}</span>
                    )}
                  </div>
                )}
              </div>

              {errorMsg && <p className="mt-3 text-xs text-brand-rose text-center">{errorMsg}</p>}

              <Button
                className="mt-6 w-full"
                onClick={handleEnroll}
                loading={enrolling}
                disabled={course.comingSoon}
              >
                {course.comingSoon ? "Coming Soon" : course.isFree ? "Enroll Now (Free)" : "Enroll Now"}
              </Button>

              <div className="mt-4 space-y-2 border-t border-brand-gray pt-4 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Access:</span>
                  <span className="font-medium text-brand-ink">Full Lifetime / Duration</span>
                </div>
                <div className="flex justify-between">
                  <span>Certificate:</span>
                  <span className="font-medium text-brand-ink">Included ✓</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment:</span>
                  <span className="font-medium text-brand-ink">Secure via Paystack</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
