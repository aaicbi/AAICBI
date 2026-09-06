"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import AvatarUpload from "@/components/AvatarUpload";

import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS, t, type LanguageCode } from "@/lib/i18n";

/**
 * The self-service side of the notification-preference gap flagged
 * across the M14/M15 audits, joined by M39's low-bandwidth toggle on
 * the same page — see this route's API comment for why this stays a
 * small, deliberate settings surface rather than a full profile-
 * editing page.
 *
 * Design-pass fixes: this page's nav was missing "Settings" itself —
 * every other trainee page has all three links, this one only had two.
 * Also swapped the old sticky "Saved." text (which, once shown, never
 * went away until the next toggle) for a real toast, consistent with
 * every other save action across this redesign.
 *
 * M42 — this page's own nav is the real, working proof that t() and
 * the approval pipeline function end to end, not just in isolation:
 * fetches whatever's actually been approved for the trainee's
 * language and applies it right here. Deliberately NOT rolled out to
 * every other page's nav in this same pass — that's real, separate
 * work (M42's own "one bounded pass across the whole app"), and doing
 * it properly means touching every page that currently hardcodes its
 * own nav array, not something to rush through as a side effect of
 * proving the mechanism works.
 */
export default function TraineeSettingsPage() {
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean | null>(null);
  const [lowBandwidthMode, setLowBandwidthMode] = useState<boolean | null>(null);
  const [preferredLanguage, setPreferredLanguage] = useState<LanguageCode | null>(null);
  const [aiStudyBuddyEnabled, setAiStudyBuddyEnabled] = useState<boolean | null>(null);
  const [aiCreditBalance, setAiCreditBalance] = useState<number | null>(null);
  const [darkMode, setDarkModeState] = useState<boolean | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [whatsappVerifiedAt, setWhatsappVerifiedAt] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  // M46 — the actual mechanism: Tailwind's `dark:` variants and the
  // CSS variables in globals.css both key off a `dark` class on
  // <html>, not on component state directly. This keeps the toggle
  // itself simple (flip one class) while the 369 existing brand-token
  // usages across the app respond automatically through the variables
  // — no per-component wiring needed.
  function applyTheme(enabled: boolean) {
    document.documentElement.classList.toggle("dark", enabled);
    // Part 8/9 — persist the choice to the same first-party `theme`
    // cookie the root layout's pre-paint script reads, so the
    // preference survives navigation and refresh across the WHOLE app,
    // not just pages that re-run this. 1-year max-age; SameSite=Lax is
    // correct for a non-sensitive UI preference. Writing "light"
    // explicitly (rather than clearing) is deliberate: absent cookie
    // means "default", which is dark — so a user who chose light must
    // record that positively or they'd snap back to dark on reload.
    document.cookie = `theme=${enabled ? "dark" : "light"}; path=/; max-age=31536000; SameSite=Lax`;
  }

  useEffect(() => {
    const currentlyDark = document.documentElement.classList.contains("dark");
    setDarkModeState(currentlyDark);
    fetch("/api/trainee/settings")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load settings");
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        if (typeof data.notificationsEnabled === "boolean") setNotificationsEnabled(data.notificationsEnabled);
        if (typeof data.lowBandwidthMode === "boolean") setLowBandwidthMode(data.lowBandwidthMode);
        if (data.preferredLanguage) setPreferredLanguage(data.preferredLanguage);
        if (typeof data.aiStudyBuddyEnabled === "boolean") setAiStudyBuddyEnabled(data.aiStudyBuddyEnabled);
        if (typeof data.darkMode === "boolean") {
          setDarkModeState(data.darkMode);
          applyTheme(data.darkMode);
        } else {
          setDarkModeState(currentlyDark);
        }
        setAiCreditBalance(data.aiCreditBalance ?? null);
        setAvatarUrl(data.avatarUrl ?? null);
        setWhatsappOptIn(!!data.whatsappOptIn);
        setWhatsappVerifiedAt(data.whatsappVerifiedAt ?? null);
        setPhone(data.phone ?? null);
        if (data.preferredLanguage) {
          return fetch(`/api/translations?language=${data.preferredLanguage}`);
        }
      })
      .then((r) => r?.json())
      .then((map) => map && setTranslations(map))
      .catch(() => {
        setNotificationsEnabled((prev) => prev ?? true);
        setLowBandwidthMode((prev) => prev ?? false);
        setPreferredLanguage((prev) => prev ?? "en");
        setAiStudyBuddyEnabled((prev) => prev ?? false);
        setDarkModeState((prev) => prev ?? currentlyDark);
      });
  }, []);

  // M39/M42/M45/M46 — every toggle saves together on the same PUT (the
  // route requires all five fields, see its own comment for why), so
  // this one function handles any of the toggles, not separate save
  // paths per setting.
  async function toggle(field: "notificationsEnabled" | "lowBandwidthMode" | "aiStudyBuddyEnabled" | "darkMode") {
    if (
      notificationsEnabled === null ||
      lowBandwidthMode === null ||
      preferredLanguage === null ||
      aiStudyBuddyEnabled === null ||
      darkMode === null
    )
      return;
    const nextNotifications = field === "notificationsEnabled" ? !notificationsEnabled : notificationsEnabled;
    const nextLowBandwidth = field === "lowBandwidthMode" ? !lowBandwidthMode : lowBandwidthMode;
    const nextAiStudyBuddy = field === "aiStudyBuddyEnabled" ? !aiStudyBuddyEnabled : aiStudyBuddyEnabled;
    const nextDarkMode = field === "darkMode" ? !darkMode : darkMode;
    setNotificationsEnabled(nextNotifications); // optimistic
    setLowBandwidthMode(nextLowBandwidth);
    setAiStudyBuddyEnabled(nextAiStudyBuddy);
    setDarkModeState(nextDarkMode);
    if (field === "darkMode") applyTheme(nextDarkMode); // instant visual feedback, don't wait on the network
    setSaving(true);
    const res = await fetch("/api/trainee/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notificationsEnabled: nextNotifications,
        lowBandwidthMode: nextLowBandwidth,
        preferredLanguage,
        aiStudyBuddyEnabled: nextAiStudyBuddy,
        darkMode: nextDarkMode,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setNotificationsEnabled(notificationsEnabled); // revert on failure
      setLowBandwidthMode(lowBandwidthMode);
      setAiStudyBuddyEnabled(aiStudyBuddyEnabled);
      setDarkModeState(darkMode);
      if (field === "darkMode") applyTheme(darkMode);
      showToast("Could not save. Please try again.", "error");
      return;
    }
    const updated = await res.json().catch(() => null);
    if (updated) {
      if (typeof updated.notificationsEnabled === "boolean") setNotificationsEnabled(updated.notificationsEnabled);
      if (typeof updated.lowBandwidthMode === "boolean") setLowBandwidthMode(updated.lowBandwidthMode);
      if (typeof updated.aiStudyBuddyEnabled === "boolean") setAiStudyBuddyEnabled(updated.aiStudyBuddyEnabled);
      if (typeof updated.darkMode === "boolean") {
        setDarkModeState(updated.darkMode);
        applyTheme(updated.darkMode);
      }
    }
    showToast("Saved.", "success");
  }

  async function changeLanguage(next: LanguageCode) {
    if (
      notificationsEnabled === null ||
      lowBandwidthMode === null ||
      preferredLanguage === null ||
      aiStudyBuddyEnabled === null ||
      darkMode === null
    )
      return;
    const previous = preferredLanguage;
    setPreferredLanguage(next); // optimistic
    setSaving(true);
    const res = await fetch("/api/trainee/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationsEnabled, lowBandwidthMode, preferredLanguage: next, aiStudyBuddyEnabled, darkMode }),
    });
    setSaving(false);
    if (!res.ok) {
      setPreferredLanguage(previous); // revert on failure
      showToast("Could not save. Please try again.", "error");
      return;
    }
    const updated = await res.json().catch(() => null);
    if (updated && updated.preferredLanguage) {
      setPreferredLanguage(updated.preferredLanguage);
    }
    showToast("Saved.", "success");
  }

  return (
    <>
      <SiteHeader
        nav={[
          { label: t("Dashboard", translations), href: "/trainee/dashboard" },
          { label: t("Courses", translations), href: "/trainee/courses" },
          { label: t("Settings", translations), href: "/trainee/settings" },
        ]}
        right={<LogoutButton />}
      />
      <main className="mx-auto max-w-md px-6 py-12">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your account and preferences.</p>

        <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-gray-500">Your account</p>
        <Card className="mt-2">
          <p className="font-display font-semibold text-brand-ink">Profile Picture</p>
          <div className="mt-3">
            <AvatarUpload avatarUrl={avatarUrl} apiPath="/api/trainee/avatar" onChange={setAvatarUrl} />
          </div>
        </Card>

        <p className="mt-8 text-xs font-semibold uppercase tracking-wide text-gray-500">Notifications</p>
        <WhatsAppSettings
          optedIn={whatsappOptIn}
          verifiedAt={whatsappVerifiedAt}
          phone={phone}
          onOptedIn={(p) => {
            setWhatsappOptIn(true);
            setPhone(p);
          }}
          onVerified={() => setWhatsappVerifiedAt(new Date().toISOString())}
          onOptedOut={() => {
            setWhatsappOptIn(false);
            setWhatsappVerifiedAt(null);
          }}
        />

        <p className="mt-8 text-xs font-semibold uppercase tracking-wide text-gray-500">Your visibility</p>
        <DiscoverabilitySettings />

        <PublicProfileSettings />

        <Card className="mt-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-display font-semibold text-brand-ink">Progress notifications</p>
              <p className="mt-1 text-sm text-gray-600">
                Email me when I unlock the next module in a course, and when an assessment result is ready.
              </p>
            </div>
            {notificationsEnabled !== null && (
              <button
                onClick={() => toggle("notificationsEnabled")}
                disabled={saving}
                role="switch"
                aria-checked={notificationsEnabled}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  notificationsEnabled ? "bg-brand-teal" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    notificationsEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            )}
          </div>
        </Card>

        <Card className="mt-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-display font-semibold text-brand-ink">Low-bandwidth mode</p>
              <p className="mt-1 text-sm text-gray-600">
                Video thumbnails won&apos;t load automatically on a lesson page — you&apos;ll see a simple icon
                instead until you tap to watch. Videos already require a tap to actually play either way; this
                just saves the thumbnail image itself too, on a slow or limited connection.
              </p>
            </div>
            {lowBandwidthMode !== null && (
              <button
                onClick={() => toggle("lowBandwidthMode")}
                disabled={saving}
                role="switch"
                aria-checked={lowBandwidthMode}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  lowBandwidthMode ? "bg-brand-teal" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    lowBandwidthMode ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            )}
          </div>
        </Card>

        <Card className="mt-4">
          <p className="font-display font-semibold text-brand-ink">Language</p>
          <p className="mt-1 text-sm text-gray-600">
            Choose the language you&apos;d like to see menus and system messages in.
          </p>
          {preferredLanguage !== null && (
            <div className="mt-3 flex flex-wrap gap-2">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  onClick={() => changeLanguage(lang)}
                  disabled={saving}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                    preferredLanguage === lang
                      ? "border-brand-teal bg-brand-mint text-brand-teal"
                      : "border-brand-gray text-gray-600"
                  }`}
                >
                  {LANGUAGE_LABELS[lang]}
                </button>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-gray-500">
            Course lesson content isn&apos;t translated yet — this only changes menus and system messages for now.
          </p>
        </Card>

        <Card className="mt-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-display font-semibold text-brand-ink">AI Study Buddy</p>
              <p className="mt-1 text-sm text-gray-600">
                Turn on AI-powered study help. This isn&apos;t available yet — turning it on now just means
                it&apos;ll be ready for you the moment it launches.
              </p>
              {aiCreditBalance !== null && (
                <p className="mt-2 text-xs text-gray-500">
                  Your credit balance: <span className="font-semibold text-brand-ink">{aiCreditBalance}</span>
                </p>
              )}
            </div>
            {aiStudyBuddyEnabled !== null && (
              <button
                onClick={() => toggle("aiStudyBuddyEnabled")}
                disabled={saving}
                role="switch"
                aria-checked={aiStudyBuddyEnabled}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  aiStudyBuddyEnabled ? "bg-brand-teal" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    aiStudyBuddyEnabled ? "translate-x-5" : "translate-x-0"
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

        <p className="mt-4 text-xs text-gray-500">
          Account verification and password reset emails always send, regardless of this setting — they&apos;re
          essential to using your account.
        </p>
      </main>
    </>
  );
}

/**
 * M43 — the actual opt-in/verify/opt-out UI. Three real states, not
 * a single toggle: not opted in, opted in but awaiting a code, and
 * verified. Honest about the one thing this app genuinely can't
 * control yet — a failed send here means "not available until
 * WhatsApp is actually live" (see whatsapp.ts's own comment), shown
 * plainly rather than implying something's broken on the trainee's
 * end.
 */
function WhatsAppSettings({
  optedIn,
  verifiedAt,
  phone,
  onOptedIn,
  onVerified,
  onOptedOut,
}: {
  optedIn: boolean;
  verifiedAt: string | null;
  phone: string | null;
  onOptedIn: (phone: string) => void;
  onVerified: () => void;
  onOptedOut: () => void;
}) {
  const [phoneInput, setPhoneInput] = useState(phone ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingNote, setPendingNote] = useState<string | null>(null);

  async function requestCode() {
    setBusy(true);
    setError(null);
    setPendingNote(null);
    const res = await fetch("/api/trainee/whatsapp/opt-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phoneInput }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not save that number. Try again.");
      return;
    }
    const data = await res.json();
    onOptedIn(phoneInput);
    if (!data.sent) {
      setPendingNote(
        typeof data.error === "string"
          ? data.error
          : "WhatsApp delivery isn't available yet — this is saved and ready for once it is."
      );
    }
  }

  async function verifyCode() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/trainee/whatsapp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not verify. Try again.");
      return;
    }
    onVerified();
  }

  async function optOut() {
    setBusy(true);
    await fetch("/api/trainee/whatsapp/opt-out", { method: "POST" });
    setBusy(false);
    onOptedOut();
  }

  return (
    <Card className="mt-4">
      <p className="font-display font-semibold text-brand-ink">WhatsApp Notifications</p>
      <p className="mt-1 text-xs text-gray-500">
        Get key updates — account verification, password reset, module unlocks, certificates, and payment codes —
        on WhatsApp too, alongside email.
      </p>

      {optedIn && verifiedAt ? (
        <div className="mt-3">
          <p className="text-xs text-brand-teal">✓ Verified — {phone}</p>
          <button onClick={optOut} disabled={busy} className="mt-2 text-xs font-semibold text-brand-rose hover:underline disabled:opacity-60">
            Turn off WhatsApp notifications
          </button>
        </div>
      ) : optedIn ? (
        <div className="mt-3 space-y-2">
          {pendingNote && <p className="text-xs text-brand-goldText">{pendingNote}</p>}
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="Enter the 6-digit code"
            aria-label="6-digit verification code"
            className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
          />
          {error && <p className="text-xs text-brand-rose">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={verifyCode}
              disabled={busy || code.length !== 6}
              className="rounded-lg bg-brand-teal px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              Verify
            </button>
            <button onClick={optOut} disabled={busy} className="text-xs font-semibold text-gray-500 hover:underline">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <input
            type="tel"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder="+2348012345678"
            aria-label="WhatsApp phone number"
            className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
          />
          {error && <p className="text-xs text-brand-rose">{error}</p>}
          <button
            onClick={requestCode}
            disabled={busy || !phoneInput.trim()}
            className="rounded-lg bg-brand-teal px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            Enable WhatsApp Notifications
          </button>
        </div>
      )}
    </Card>
  );
}

interface CertificateOption {
  id: string;
  courseTitle: string;
  revoked: boolean;
  included: boolean;
}

/**
 * M32 — the granular controls behind the one toggle M30 already
 * established: what a browsing employer sees before any introduction
 * exists. Self-contained, fetching its own data independently rather
 * than threaded through the parent settings page's own load effect —
 * this is a genuinely separate settings surface with its own route,
 * the same reasoning already applied to WhatsAppSettings right above.
 * Revoked certificates aren't shown as an option to include at
 * all — not just rejected server-side (which the route also does) but
 * never offered here in the first place, so a trainee never even sees
 * a choice that couldn't actually take effect.
 */
function DiscoverabilitySettings() {
  const [discoverable, setDiscoverable] = useState(false);
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [certificates, setCertificates] = useState<CertificateOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    fetch("/api/trainee/discoverability")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        setDiscoverable(data.publiclyDiscoverable);
        setHeadline(data.discoverableHeadline ?? "");
        setBio(data.discoverableBio ?? "");
        setCertificates(data.certificates);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  function toggleCertificate(id: string) {
    setCertificates((prev) => prev.map((c) => (c.id === id ? { ...c, included: !c.included } : c)));
  }

  async function save() {
    setSaving(true);
    const res = await fetch("/api/trainee/discoverability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publiclyDiscoverable: discoverable,
        discoverableHeadline: headline.trim() || null,
        discoverableBio: bio.trim() || null,
        certificateIds: certificates.filter((c) => c.included).map((c) => c.id),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      showToast("Could not save. Try again.", "error");
      return;
    }
    showToast("Saved.");
  }

  if (!loaded) return null;

  return (
    <Card className="mt-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display font-semibold text-brand-ink">Employer Discoverability</p>
          <p className="mt-1 text-xs text-gray-500">
            Let vetted employers browsing on AAICBI find you and reach out. Your contact information is never shown
            until you accept a specific introduction — turning this on only makes your listing visible.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={discoverable}
          onClick={() => setDiscoverable((v) => !v)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${discoverable ? "bg-brand-teal" : "bg-brand-gray"}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${discoverable ? "translate-x-5" : "translate-x-0"}`}
          />
        </button>
      </div>

      {discoverable && (
        <div className="mt-4 space-y-3 border-t border-brand-gray pt-4">
          <div>
            <label htmlFor="discoverable-headline" className="text-xs font-semibold text-gray-600">
              Headline (optional)
            </label>
            <input
              id="discoverable-headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              maxLength={120}
              placeholder="Full-stack developer, AAICBI Cohort 2026"
              className="mt-1 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
            />
          </div>
          <div>
            <label htmlFor="discoverable-bio" className="text-xs font-semibold text-gray-600">
              About you (optional)
            </label>
            <textarea
              id="discoverable-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="A short note about what you're looking for..."
              className="mt-1 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
            />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-600">Certificates to include</p>
            {certificates.filter((c) => !c.revoked).length === 0 ? (
              <p className="mt-1 text-xs text-gray-500">You don't have any certificates yet.</p>
            ) : (
              <div className="mt-1 space-y-1.5">
                {certificates
                  .filter((c) => !c.revoked)
                  .map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={c.included} onChange={() => toggleCertificate(c.id)} />
                      {c.courseTitle}
                    </label>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      <Button onClick={save} loading={saving} className="mt-4">
        Save
      </Button>
    </Card>
  );
}

/**
 * M37 — the "reachable only via a link the trainee generates and
 * shares themselves" mechanism, matching /certificate/[code]'s
 * pattern from M15 but for a profile instead of a credential.
 * Deliberately shows the discoverability requirement plainly if it's
 * off — generating a link when the profile can't actually be viewed
 * yet would be confusing, not helpful.
 */
function PublicProfileSettings() {
  const [url, setUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    fetch("/api/trainee/public-profile")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setUrl(data.url))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  async function generate() {
    setBusy(true);
    const res = await fetch("/api/trainee/public-profile", { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      showToast("Could not generate a link. Try again.", "error");
      return;
    }
    const data = await res.json();
    setUrl(data.url);
    showToast(url ? "New link generated — the old one no longer works." : "Link generated.");
  }

  function copy() {
    if (!url) return;
    navigator.clipboard.writeText(url);
    showToast("Copied.");
  }

  if (!loaded) return null;

  return (
    <Card className="mt-4">
      <p className="font-display font-semibold text-brand-ink">Public Profile Link</p>
      <p className="mt-1 text-xs text-gray-500">
        A shareable link to your profile — useful for a resume or LinkedIn. Not listed or searchable anywhere; only
        works while employer discoverability above is turned on.
      </p>

      {url && (
        <div className="mt-3 flex items-center gap-2">
          <input
            readOnly
            value={url}
            className="w-full rounded-lg border border-brand-gray bg-gray-50 px-3 py-2 text-sm text-gray-600"
          />
          <button onClick={copy} className="shrink-0 text-xs font-semibold text-brand-teal hover:underline">
            Copy
          </button>
        </div>
      )}

      <Button onClick={generate} loading={busy} className="mt-3">
        {url ? "Generate New Link" : "Generate Link"}
      </Button>
    </Card>
  );
}
