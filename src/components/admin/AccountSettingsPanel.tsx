"use client";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Toggle from "@/components/ui/Toggle";
import { useToast } from "@/components/ui/Toast";
import AvatarUpload from "@/components/AvatarUpload";
import { SkeletonList } from "@/components/ui/Skeleton";

/**
 * Settings-page redesign — the personal-preferences half of the old
 * /admin/settings page (M47's AI assistant toggle, M46's dark mode),
 * extracted into its own panel so the page itself can be a proper
 * category shell instead of one long flat list. Behavior is otherwise
 * unchanged: same API, same optimistic-update-then-revert-on-failure
 * pattern — this is a re-skin, not a rewrite. The only real change is
 * swapping the two hand-rolled `role="switch"` buttons for the shared
 * `Toggle` component (src/components/ui/Toggle.tsx), which that
 * component's own comment already flagged as a deliberate later
 * cleanup rather than something to retrofit everywhere at once.
 */
export default function AccountSettingsPanel() {
  const [aiAssistantEnabled, setAiAssistantEnabled] = useState<boolean | null>(null);
  const [darkMode, setDarkModeState] = useState<boolean | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  function applyTheme(enabled: boolean) {
    document.documentElement.classList.toggle("dark", enabled);
    document.cookie = `theme=${enabled ? "dark" : "light"}; path=/; max-age=31536000; SameSite=Lax`;
  }

  useEffect(() => {
    const currentlyDark = document.documentElement.classList.contains("dark");
    setDarkModeState(currentlyDark);
    fetch("/api/admin/settings")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load settings");
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        if (typeof data.aiAssistantEnabled === "boolean") setAiAssistantEnabled(data.aiAssistantEnabled);
        if (typeof data.darkMode === "boolean") {
          setDarkModeState(data.darkMode);
          applyTheme(data.darkMode);
        } else {
          setDarkModeState(currentlyDark);
        }
        setAvatarUrl(data.avatarUrl ?? null);
      })
      .catch(() => {
        setAiAssistantEnabled((prev) => prev ?? false);
        setDarkModeState((prev) => prev ?? currentlyDark);
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
      showToast("We couldn't save that change. Please try again.", "error");
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

  if (aiAssistantEnabled === null || darkMode === null) {
    return <SkeletonList rows={3} />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <p className="font-display font-semibold text-brand-ink">Profile Picture</p>
        <p className="mt-1 text-sm text-gray-600">Shown next to your name across the platform.</p>
        <div className="mt-3">
          <AvatarUpload avatarUrl={avatarUrl} apiPath="/api/admin/avatar" onChange={setAvatarUrl} />
        </div>
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display font-semibold text-brand-ink">AI Platform Assistant</p>
            <p className="mt-1 text-sm text-gray-600">
              Reports, analytics, and management help powered by AI. Not available yet — turning this on now just
              means it&apos;ll be ready for you the moment it launches.
            </p>
          </div>
          <Toggle
            checked={aiAssistantEnabled}
            onChange={() => toggle("aiAssistantEnabled")}
            disabled={saving}
            label="AI Platform Assistant"
          />
        </div>
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display font-semibold text-brand-ink">Dark Mode</p>
            <p className="mt-1 text-sm text-gray-600">Switch to a dark theme. This follows you across devices.</p>
          </div>
          <Toggle checked={darkMode} onChange={() => toggle("darkMode")} disabled={saving} label="Dark Mode" />
        </div>
      </Card>
    </div>
  );
}
