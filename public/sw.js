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
const VERSION = "v1";
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
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("aaicbi-") && k !== STATIC_CACHE && k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
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

  // A page: always the network. Only when it cannot be reached, show the offline page.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match(OFFLINE_URL)) || new Response("You are offline.", { status: 503, headers: { "Content-Type": "text/plain" } })),
    );
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
  event.waitUntil(self.registration.showNotification(title, options));
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
