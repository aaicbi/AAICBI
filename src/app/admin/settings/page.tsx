"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import AvatarUpload from "@/components/AvatarUpload";

/**
 * M47/M46 — the staff-facing counterpart to /trainee/settings,
 * starting small rather than growing into a full profile page. See
 * the API route's own comment for why.
 */
export default function AdminSettingsPage() {
  const [aiAssistantEnabled, setAiAssistantEnabled] = useState<boolean | null>(null);
  const [darkMode, setDarkModeState] = useState<boolean | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  // Same mechanism as the trainee settings page — see that file's own
  // comment on why this keys off a class on <html> rather than
  // per-component wiring.
  function applyTheme(enabled: boolean) {
    document.documentElement.classList.toggle("dark", enabled);
    // Part 8/9 — persist to the `theme` cookie the root layout reads pre-paint, so the choice holds app-wide (see trainee/settings for the full rationale).
    document.cookie = `theme=${enabled ? "dark" : "light"}; path=/; max-age=31536000; SameSite=Lax`;
  }

  useEffect(() => {
    const currentlyDark = document.documentElement.classList.contains("dark");
    setDarkModeState(currentlyDark);
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        if (!data) return;
        if (typeof data.aiAssistantEnabled === "boolean") setAiAssistantEnabled(data.aiAssistantEnabled);
        if (typeof data.darkMode === "boolean") {
          setDarkModeState(data.darkMode);
          applyTheme(data.darkMode);
        }
        setAvatarUrl(data.avatarUrl ?? null);
      })
      .catch(() => {
        setAiAssistantEnabled(false);
      });
  }, []);

  async function toggle(field: "aiAssistantEnabled" | "darkMode") {
    if (aiAssistantEnabled === null || darkMode === null) return;
    const nextAi = field === "aiAssistantEnabled" ? !aiAssistantEnabled : aiAssistantEnabled;
    const nextDark = field === "darkMode" ? !darkMode : darkMode;
    setAiAssistantEnabled(nextAi); // optimistic
    setDarkModeState(nextDark);
    if (field === "darkMode") applyTheme(nextDark);
    setSaving(true);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiAssistantEnabled: nextAi, darkMode: nextDark }),
    });
    setSaving(false);
    if (!res.ok) {
      setAiAssistantEnabled(aiAssistantEnabled); // revert on failure
      setDarkModeState(darkMode);
      if (field === "darkMode") applyTheme(darkMode);
      showToast("Could not save. Please try again.", "error");
      return;
    }
    const updated = await res.json().catch(() => null);
    if (updated) {
      if (typeof updated.aiAssistantEnabled === "boolean") setAiAssistantEnabled(updated.aiAssistantEnabled);
      if (typeof updated.darkMode === "boolean") {
        setDarkModeState(updated.darkMode);
        applyTheme(updated.darkMode);
      }
    }
    showToast("Saved.", "success");
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
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your account, and jump to the areas you administer.
        </p>

        {/* Part 5 — the five destinations that used to be cramped,
            underlined text links directly under the heading (reading
            as an afterthought) are now a proper navigation panel:
            real, tappable rows with a label and a one-line description
            of what each area is for, visually distinct from the actual
            on-page account settings below. Deliberately NOT a faked
            "Profile / Security / Password" sidenav — those sections
            don't exist as separate pages in this app, and inventing
            empty ones is exactly what the audit warns against. These
            are genuine admin areas, so they're presented honestly as
            navigation, grouped and labelled, not disguised as tabs of
            a settings form they aren't part of. */}
        <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-gray-500">Admin areas</p>
        <nav className="mt-2 grid gap-2 sm:grid-cols-2">
          {[
            { href: "/admin/platform-settings", label: "Platform-wide settings", desc: "Global configuration for the whole platform" },
            { href: "/admin/employers", label: "Employer accounts", desc: "Review and approve employer registrations" },
            { href: "/admin/job-postings", label: "Job posting review", desc: "Approve or reject submitted job postings" },
            { href: "/admin/testimonials", label: "Testimonials", desc: "Curate trainee reviews shown publicly" },
            { href: "/admin/staff", label: "Staff accounts", desc: "Create and manage staff members" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="group flex items-center justify-between rounded-xl border border-brand-gray bg-brand-surface p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-teal hover:shadow-md"
            >
              <span>
                <span className="block text-sm font-semibold text-brand-ink">{item.label}</span>
                <span className="mt-0.5 block text-xs text-gray-500">{item.desc}</span>
              </span>
              <span className="ml-3 text-brand-teal transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true">
                →
              </span>
            </a>
          ))}
        </nav>

        <p className="mt-8 text-xs font-semibold uppercase tracking-wide text-gray-500">Your account</p>
        <Card className="mt-2">
          <p className="font-display font-semibold text-brand-ink">Profile Picture</p>
          <div className="mt-3">
            <AvatarUpload avatarUrl={avatarUrl} apiPath="/api/admin/avatar" onChange={setAvatarUrl} />
          </div>
        </Card>

        <Card className="mt-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-display font-semibold text-brand-ink">AI Platform Assistant</p>
              <p className="mt-1 text-sm text-gray-600">
                Reports, analytics, and management help powered by AI. Not available yet — turning this on now just
                means it&apos;ll be ready for you the moment it launches.
              </p>
            </div>
            {aiAssistantEnabled !== null && (
              <button
                onClick={() => toggle("aiAssistantEnabled")}
                disabled={saving}
                role="switch"
                aria-checked={aiAssistantEnabled}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  aiAssistantEnabled ? "bg-brand-teal" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    aiAssistantEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            )}
          </div>
        </Card>

        <Card className="mt-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-display font-semibold text-brand-ink">Dark Mode</p>
              <p className="mt-1 text-sm text-gray-600">Switch to a dark theme. This follows you across devices.</p>
            </div>
            {darkMode !== null && (
              <button
                onClick={() => toggle("darkMode")}
                disabled={saving}
                role="switch"
                aria-checked={darkMode}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  darkMode ? "bg-brand-teal" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    darkMode ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            )}
          </div>
        </Card>
      </main>
    </>
  );
}
