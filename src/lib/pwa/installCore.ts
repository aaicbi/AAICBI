/** Pure rules for when to offer "Install the app". No browser access, so they are unit-testable. */

export const INSTALL_STORE_KEY = "pwa-install-v1";
const DISMISS_DAYS = 30;
const MIN_VISITS = 2;

export interface InstallMemory {
  /** Visits (sessions) this browser has made. */
  visits: number;
  /** When the person last said "Not now", as a timestamp, or null. */
  dismissedAt: number | null;
}

export const FRESH_INSTALL_MEMORY: InstallMemory = { visits: 0, dismissedAt: null };

/** iPhone and iPad Safari have no install button for pages; people must use Share → Add to Home Screen. */
export function isIosDevice(userAgent: string, maxTouchPoints = 0): boolean {
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  // iPadOS 13+ reports itself as a Mac, but has a touch screen.
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

/**
 * Offer only to someone who has come back at least once, who has not
 * installed it, and who has not recently dismissed the offer. The browser
 * must also actually be able to install (it fired its install event) or be
 * an iPhone/iPad where instructions are shown instead.
 */
export function shouldOfferInstall(
  memory: InstallMemory,
  now: number,
  env: { installed: boolean; canPrompt: boolean; ios: boolean },
): boolean {
  if (env.installed) return false;
  if (!env.canPrompt && !env.ios) return false;
  if (memory.visits < MIN_VISITS) return false;
  if (memory.dismissedAt !== null && now - memory.dismissedAt < DISMISS_DAYS * 24 * 3600 * 1000) return false;
  return true;
}

export function parseInstallMemory(raw: string | null): InstallMemory {
  try {
    const v = raw ? (JSON.parse(raw) as Partial<InstallMemory>) : {};
    return {
      visits: typeof v.visits === "number" && v.visits >= 0 ? Math.floor(v.visits) : 0,
      dismissedAt: typeof v.dismissedAt === "number" ? v.dismissedAt : null,
    };
  } catch {
    return FRESH_INSTALL_MEMORY;
  }
}

/** Pages where nothing should interrupt: live exams and assessments. */
export function installPromptHidden(pathname: string): boolean {
  const s = pathname.split("/").filter(Boolean);
  return s[0] === "exam" || s.includes("take") || s.includes("assessment") || s.includes("examination");
}

export type InstallButtonMode = "none" | "prompt" | "ios" | "manual";

/** True for phones and tablets (not laptops) from the user-agent. */
export function isMobileDevice(userAgent: string, maxTouchPoints = 0): boolean {
  return isIosDevice(userAgent, maxTouchPoints) || /Android|Mobile/i.test(userAgent);
}

/**
 * What the always-visible "Add to home screen" button should do. It is
 * offered on any phone or tablet that has not installed the app: the real
 * install prompt when the browser has handed it over, Safari's Share steps
 * on iPhone/iPad, and the browser-menu steps everywhere else (some
 * Android browsers never fire the install event).
 */
export function installButtonMode(env: { installed: boolean; canPrompt: boolean; ios: boolean; mobile: boolean }): InstallButtonMode {
  if (env.installed) return "none";
  if (env.canPrompt) return "prompt";
  if (env.ios) return "ios";
  return env.mobile ? "manual" : "none";
}
