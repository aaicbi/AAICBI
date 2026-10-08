import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import manifest from "@/app/manifest";
import { launchDestination, parseLaunchTarget } from "@/lib/pwa/launch";
import { FRESH_INSTALL_MEMORY, installPromptHidden, isIosDevice, parseInstallMemory, shouldOfferInstall } from "@/lib/pwa/installCore";
import { BOTTOM_NAV, bottomNavHidden, isTabActive, unreadLabel } from "@/lib/pwa/mobileNav";
import { cardLabels } from "@/lib/pwa/tableCards";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("the web app manifest", () => {
  const m = manifest();
  it("is an installable standalone app with the brand identity", () => {
    expect(m.name).toBe("AAICBI");
    expect(m.short_name).toBe("AAICBI");
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/app");
    expect(m.scope).toBe("/");
    expect(m.theme_color).toBe("#016B61");
  });
  it("has the icons browsers require, all present on disk, including a maskable one", () => {
    const sizes = (m.icons ?? []).map((i) => `${i.sizes}:${i.purpose}`);
    expect(sizes).toContain("192x192:any");
    expect(sizes).toContain("512x512:any");
    expect(sizes).toContain("512x512:maskable");
    for (const i of m.icons ?? []) expect(() => readFileSync(join(process.cwd(), "public", i.src)), i.src).not.toThrow();
  });
  it("shortcuts all go through the launch route", () => {
    for (const s of m.shortcuts ?? []) expect(s.url).toMatch(/^\/app\?to=/);
  });
});

describe("where the installed app opens", () => {
  it("sends each kind of account to its own home, and signed-out visitors to the landing page", () => {
    expect(launchDestination("trainee", null)).toBe("/trainee/dashboard");
    expect(launchDestination("employer", null)).toBe("/employer/dashboard");
    expect(launchDestination("organization", null)).toBe("/admin/organization");
    expect(launchDestination(null, null)).toBe("/");
    expect(launchDestination(null, "messages")).toBe("/");
  });
  it("honours shortcuts, falling back to home where an account has no such page", () => {
    expect(launchDestination("trainee", "messages")).toBe("/trainee/messages");
    expect(launchDestination("employer", "messages")).toBe("/employer/messages");
    expect(launchDestination("organization", "messages")).toBe("/admin/messages");
    expect(launchDestination("investor", "messages")).toBe("/investor/dashboard");
    expect(launchDestination("organization", "events")).toBe("/admin/organization/events");
    expect(launchDestination("investor", "notifications")).toBe("/notifications");
    expect(launchDestination("trainee", parseLaunchTarget("nonsense"))).toBe("/trainee/dashboard");
  });
});

describe("when to offer installation", () => {
  const env = { installed: false, canPrompt: true, ios: false };
  const now = Date.UTC(2026, 9, 10);
  it("waits for a second visit, and is never shown to an installed app", () => {
    expect(shouldOfferInstall({ visits: 1, dismissedAt: null }, now, env)).toBe(false);
    expect(shouldOfferInstall({ visits: 2, dismissedAt: null }, now, env)).toBe(true);
    expect(shouldOfferInstall({ visits: 5, dismissedAt: null }, now, { ...env, installed: true })).toBe(false);
  });
  it("stays quiet for a month after Not now", () => {
    expect(shouldOfferInstall({ visits: 5, dismissedAt: now - 5 * 86400000 }, now, env)).toBe(false);
    expect(shouldOfferInstall({ visits: 5, dismissedAt: now - 40 * 86400000 }, now, env)).toBe(true);
  });
  it("needs a way to install: the browser's prompt, or iPhone/iPad instructions", () => {
    expect(shouldOfferInstall({ visits: 5, dismissedAt: null }, now, { installed: false, canPrompt: false, ios: false })).toBe(false);
    expect(shouldOfferInstall({ visits: 5, dismissedAt: null }, now, { installed: false, canPrompt: false, ios: true })).toBe(true);
  });
  it("recognises iPhone, iPad and iPadOS pretending to be a Mac", () => {
    expect(isIosDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe(false);
    expect(isIosDevice("Mozilla/5.0 (Linux; Android 14)")).toBe(false);
  });
  it("never interrupts a live exam, and survives bad stored data", () => {
    expect(installPromptHidden("/exam/ABC/take")).toBe(true);
    expect(installPromptHidden("/trainee/courses/c1/modules/m1/assessment")).toBe(true);
    expect(installPromptHidden("/trainee/dashboard")).toBe(false);
    expect(parseInstallMemory("{not json")).toEqual(FRESH_INSTALL_MEMORY);
    expect(parseInstallMemory(JSON.stringify({ visits: -3, dismissedAt: "x" }))).toEqual(FRESH_INSTALL_MEMORY);
  });
});

describe("the phone bottom navigation", () => {
  it("points only at pages that exist for that account, and always includes Alerts", () => {
    for (const [role, tabs] of Object.entries(BOTTOM_NAV)) {
      expect(tabs.some((t) => t.key === "alerts"), role).toBe(true);
      expect(tabs.length, role).toBeLessThanOrEqual(4); // plus More = at most five targets
    }
    // Investors have no messaging yet, so they are not offered a Messages tab; everyone who can message is.
    expect(BOTTOM_NAV.investor.some((t) => t.key === "messages")).toBe(false);
    for (const role of ["trainee", "employer", "organization", "staff"] as const) expect(BOTTOM_NAV[role].some((t) => t.key === "messages"), role).toBe(true);
  });
  it("marks the current tab, and the home tab only on its own page", () => {
    const [home, messages] = BOTTOM_NAV.trainee;
    expect(isTabActive(home, "/trainee/dashboard")).toBe(true);
    expect(isTabActive(messages, "/trainee/messages/abc")).toBe(true);
    expect(isTabActive(messages, "/trainee/messages-other")).toBe(false);
  });
  it("stays out of live exams and caps the unread badge", () => {
    expect(bottomNavHidden("/trainee/courses/c1/examination/take")).toBe(true);
    expect(bottomNavHidden("/exam/CODE/take")).toBe(true);
    expect(bottomNavHidden("/trainee/dashboard")).toBe(false);
    expect(unreadLabel(7)).toBe("7");
    expect(unreadLabel(250)).toBe("99+");
  });
});

describe("tables on phones", () => {
  const h = (...t: string[]) => t.map((text) => ({ text, colSpan: 1 }));
  it("labels each cell from its column heading", () => {
    expect(cardLabels(h("Name", " Status ", ""), [1, 1, 1])).toEqual(["Name", "Status", ""]);
  });
  it("leaves tables with merged cells or no headings as tables", () => {
    expect(cardLabels([], [1])).toBeNull();
    expect(cardLabels([{ text: "A", colSpan: 2 }], [1])).toBeNull();
    expect(cardLabels(h("A", "B"), [2])).toBeNull();
    expect(cardLabels(h("A"), [1, 1])).toBeNull();
  });
});

describe("the service worker never keeps anything personal", () => {
  const sw = read("public/sw.js");
  it("does not intercept API calls, and only stores public app files", () => {
    expect(sw).toMatch(/pathname\.startsWith\("\/api\/"\)\) return/);
    expect(sw).toMatch(/\/_next\/static\//);
    // Pages are fetched from the network only; the sole page it ever serves from storage is the offline page.
    expect(sw).not.toMatch(/cache\.put\(req.*navigate/);
    expect(sw).toMatch(/OFFLINE_URL/);
  });
  it("only opens addresses on this site from a notification", () => {
    expect(sw).toMatch(/startsWith\("\/"\)/);
  });
  it("has an offline page that retries", () => {
    const html = read("public/offline.html");
    expect(html).toMatch(/location\.reload/);
  });
});

import { buildPushPayload, SubscriptionSchema } from "@/lib/push/core";
import { urlBase64ToUint8Array } from "@/lib/push/client";

describe("web push", () => {
  it("sends only a short title, line and site path, and never the text of a message", () => {
    const p = buildPushPayload({ type: "EVENT_REMINDER", title: "Open day tomorrow", body: "x".repeat(500), url: "/events" });
    expect(p.body.length).toBeLessThanOrEqual(120);
    expect(p.url).toBe("/events");
    const m = buildPushPayload({ type: "MESSAGE_TO_ADMIN", title: "New message", body: "my private words", url: "/admin/messages" });
    expect(m.body).not.toContain("private");
  });
  it("never opens another site from a push", () => {
    for (const bad of ["https://evil.example.com", "//evil.example.com", "javascript:alert(1)", null, undefined, ""]) {
      expect(buildPushPayload({ type: "X", title: "t", body: "b", url: bad as string | null }).url, String(bad)).toBe("/notifications");
    }
  });
  it("accepts only well-formed https subscriptions", () => {
    const keys = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u", auth: "tBHItJI5svbpez7KI4CCXg" };
    expect(SubscriptionSchema.safeParse({ endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys }).success).toBe(true);
    expect(SubscriptionSchema.safeParse({ endpoint: "http://insecure.example.com/x", keys }).success).toBe(false);
    expect(SubscriptionSchema.safeParse({ endpoint: "https://fcm.googleapis.com/x", keys: { p256dh: "x", auth: "y" } }).success).toBe(false);
  });
  it("decodes the public key the browser needs", () => {
    expect(Array.from(urlBase64ToUint8Array("AQID"))).toEqual([1, 2, 3]);
    expect(Array.from(urlBase64ToUint8Array("-_8"))).toEqual([251, 255]);
  });
  it("the subscribe route is tied to the signed-in account", () => {
    const src = read("src/app/api/push/subscribe/route.ts");
    expect(src.match(/getSession\(\)/g)?.length).toBe(3);
    expect(src).toMatch(/resolveNotificationRecipient/);
    expect(src).toMatch(/\.\.\.who, endpoint/);
  });
  it("the notifications page and the bell use the same account-to-bucket rule, so organizations see their own", () => {
    expect(read("src/app/notifications/page.tsx")).toMatch(/resolveNotificationRecipient\(session\)/);
  });
  it("trainee video notices reach the organization's own bell", () => {
    expect(read("src/app/api/trainee/videos/route.ts")).toMatch(/recipientType: "TRAINING_ORG"/);
  });
});
