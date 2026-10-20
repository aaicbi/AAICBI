const { staffSignInPath } = require("./src/lib/staffAccessPath");

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // The page knows which release it came from, so an open game tab can notice a newer release and reload itself.
  env: { NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || "" },
  experimental: {
    // Only the icons and chart parts a page uses are sent to the phone, not the whole library.
    optimizePackageImports: ["lucide-react", "recharts"],
    serverActions: {
      bodySizeLimit: "10mb", // allow DOCX uploads through server actions if used
    },
    // Real production bug, confirmed via InstructorAgreement.pdfAttachmentError
    // (see that field's own comment): @react-pdf/renderer's underlying
    // pdfkit dependency loads its standard-14 font files (Helvetica,
    // Courier, etc.) via a runtime require() built from a string, which
    // Vercel's build-time file tracer can't follow statically — the
    // exact files (node_modules/pdfkit/js/standard-fonts/*.cjs) were
    // simply missing from the deployed function bundle, throwing
    // "Cannot find module ... Helvetica.cjs" the moment any PDF
    // (agreement letters, course curricula, performance exports — every
    // @react-pdf/renderer document in this app uses these fonts) tried
    // to render on Vercel, while working perfectly in local dev the
    // whole time. Forcing inclusion here fixes all of them at once,
    // not just the one that happened to get diagnosed first.
    outputFileTracingIncludes: {
      "/api/**/*": ["./node_modules/pdfkit/js/standard-fonts/**/*"],
    },
  },
};

// The service worker file must always be re-checked by the browser (so an
// update is picked up), may control the whole site, and runs under its own
// strict policy. The manifest and offline page are small and may be cached briefly.
nextConfig.headers = async () => [
  {
    source: "/sw.js",
    headers: [
      { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
      { key: "Service-Worker-Allowed", value: "/" },
      { key: "Content-Type", value: "application/javascript; charset=utf-8" },
    ],
  },
  // Fixed public files (the play card, icons, logos, patterns) are kept by the browser for a day and refreshed quietly after that,
  // so a repeat visit on a slow network does not download them again.
  ...["/growth/:path*", "/icons/:path*", "/logo.svg", "/wallpaper-pattern.svg", "/wallpaper-pattern-dark.svg"].map((source) => ({
    source,
    headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
  })),
  { source: "/offline.html", headers: [{ key: "Cache-Control", value: "public, max-age=3600" }] },
  // Staff areas and their sign-in addresses are never for search engines.
  ...[staffSignInPath(), "/staff-access", "/admin/:path*", "/instructor/:path*"].map((source) => ({
    source,
    headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
  })),
];

// /@handle is the public address of every profile; the page itself lives at /p/[handle]
// (a folder cannot start with @ in the app router).
// The staff sign-in address (STAFF_SIGN_IN_PATH, see src/lib/staffAccessPath.js) is served by the internal /staff-access page.
nextConfig.rewrites = async () => [
  { source: "/@:handle", destination: "/p/:handle" },
  { source: staffSignInPath(), destination: "/staff-access" },
];

module.exports = nextConfig;
