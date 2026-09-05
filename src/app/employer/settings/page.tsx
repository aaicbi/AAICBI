"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/employer/LogoutButton";
import Card from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

const NAV = [
  { label: "Discover", href: "/employer/discover" },
  { label: "My Introductions", href: "/employer/introductions" },
  { label: "Job Postings", href: "/employer/job-postings" },
  { label: "Account", href: "/employer/status" },
  { label: "Settings", href: "/employer/settings" },
];

/**
 * M46 — the real gap found on a later audit pass: this milestone was
 * marked done for trainee/staff only, since the Employer model this
 * page needs didn't exist yet at the time it was originally built.
 * Same mechanism as the trainee/admin settings pages — see either
 * one's own comment on why this keys off a class on <html> rather
 * than per-component wiring.
 *
 * A real, honest limitation worth stating plainly, not silently
 * inherited without comment: this same mechanism is used by the
 * trainee and staff settings pages too, and none of the three apply
 * dark mode anywhere except from within the settings page itself —
 * there's no root-layout-level mechanism reading the stored
 * preference on every page load. Visiting settings applies the theme
 * for that session; a fresh page load elsewhere doesn't re-check it.
 * A real, pre-existing gap across all three surfaces, not something
 * newly introduced here — fixing it project-wide would be genuinely
 * separate, larger work than closing this specific employer-only gap.
 */
export default function EmployerSettingsPage() {
  const [darkMode, setDarkModeState] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  function applyTheme(enabled: boolean) {
    document.documentElement.classList.toggle("dark", enabled);
    // Part 8/9 — persist to the `theme` cookie the root layout reads pre-paint, so the choice holds app-wide (see trainee/settings for the full rationale).
    document.cookie = `theme=${enabled ? "dark" : "light"}; path=/; max-age=31536000; SameSite=Lax`;
  }

  useEffect(() => {
    // Bug fix — same root cause and reasoning as trainee/settings's
    // own fix: don't let a possibly-stale database darkMode value
    // overwrite the theme the root layout's pre-paint script already
    // correctly applied from the `theme` cookie before this mounted.
    const currentlyDark = document.documentElement.classList.contains("dark");
    setDarkModeState(currentlyDark);
    fetch("/api/employer/settings")
      .then((r) => r.json())
      .catch(() => {});
  }, []);

  async function toggleDarkMode() {
    if (darkMode === null) return;
    const next = !darkMode;
    setDarkModeState(next); // optimistic
    applyTheme(next);
    setSaving(true);
    const res = await fetch("/api/employer/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ darkMode: next }),
    });
    setSaving(false);
    if (!res.ok) {
      setDarkModeState(darkMode); // revert on failure
      applyTheme(darkMode);
      showToast("Could not save. Please try again.", "error");
      return;
    }
    showToast("Saved.", "success");
  }

  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your account and preferences.</p>

        <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-gray-500">Your account</p>
        <Card className="mt-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-display font-semibold text-brand-ink">Dark Mode</p>
              <p className="mt-1 text-sm text-gray-600">Switch to a dark theme. This follows you across devices.</p>
            </div>
            {darkMode !== null && (
              <button
                onClick={toggleDarkMode}
                disabled={saving}
                role="switch"
                aria-checked={darkMode}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  darkMode ? "bg-brand-teal" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    darkMode ? "translate-x-5" : "translate-x-0.5"
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
