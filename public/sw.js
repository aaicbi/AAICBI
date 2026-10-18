/*
 * AAICBI service worker.
 *
 * What it does: keeps the app's own files (scripts, styles, fonts, icons)
 * in the browser so the app opens fast and a poor connection does not
 * leave a blank screen, and shows a branded offline page when a page
 * cannot be reached. It also receives web push messages.
 *
 * What it deliberately never does: store any page's HTML, any API
 * response, or anything personal. Pages and /api/* always go to the
 * network, so nothing about a signed-in person (messages, results,
 * profiles, admin data) is ever kept by this worker. Logging out
 * therefore leaves nothing behind to clean up.
 */
const VERSION = "v4";
const STATIC_CACHE = `aaicbi-static-${VERSION}`;
const SHELL_CACHE = `aaicbi-shell-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const SHELL_FILES = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png", "/logo.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then(async (keys) => {
        const old = keys.filter((k) => k.startsWith("aaicbi-") && k !== STATIC_CACHE && k !== SHELL_CACHE);
        await Promise.all(old.map((k) => caches.delete(k)));
        await self.clients.claim();
        // Only when this replaces an older release (not on a first visit): reload any game window still showing the old one,
        // such as a home-screen bookmark that iOS kept alive.
        if (old.length) {
          const windows = await self.clients.matchAll({ type: "window" });
          windows.forEach((w) => { if (w.url.includes("/trainee/arena") && "navigate" in w) w.navigate(w.url).catch(() => undefined); });
        }
      }),
  );
});

// Public, content-hashed or fixed app files: safe to keep, never personal.
function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/logo.svg";
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // never cached, never intercepted

  if (isStaticAsset(url)) {
    event.respondWith(
      // Look in every cache first: the icons were stored with the offline page, the rest as they were used.
      caches.match(req).then(async (hit) => {
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) caches.open(STATIC_CACHE).then((c) => c.put(req, res.clone()));
        return res;
      }),
    );
    return;
  }

  // A page: the browser's own network stack handles it, so redirects (sign-in
  // returns from Google, role redirects) behave exactly as without a worker.
  // Answering navigations with fetch() from here breaks redirected
  // navigations in some mobile Safari/WebKit versions. Only when the device
  // reports it is offline do we step in with the offline page.
  if (req.mode === "navigate" && self.navigator && self.navigator.onLine === false) {
    event.respondWith(caches.match(OFFLINE_URL).then((hit) => hit || new Response("You are offline.", { status: 503, headers: { "Content-Type": "text/plain" } })));
  }
});

// --- Web push -------------------------------------------------------------
// The server sends only a title, a short line and a page address; opening a
// notification goes to that page, where the normal sign-in rules apply.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  const title = typeof data.title === "string" && data.title ? data.title : "AAICBI";
  const options = {
    body: typeof data.body === "string" ? data.body : "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-32.png",
    tag: typeof data.tag === "string" ? data.tag : undefined,
    data: { url: typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/notifications" },
  };
  // The app icon carries the number of unread messages when the sender knows it (installed apps only; ignored elsewhere).
  const count = typeof data.badge === "number" ? data.badge : null;
  const setBadge = count !== null && self.navigator && "setAppBadge" in self.navigator
    ? (count > 0 ? self.navigator.setAppBadge(count) : self.navigator.clearAppBadge()).catch(() => undefined)
    : Promise.resolve();
  event.waitUntil(Promise.all([self.registration.showNotification(title, options), setBadge]));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/notifications";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
