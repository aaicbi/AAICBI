import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import TourGuideButton from "@/components/TourGuideButton";
import LoopGuide from "@/components/guide/LoopGuide";
import PwaRegister from "@/components/pwa/PwaRegister";
import NetworkStatus from "@/components/pwa/NetworkStatus";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import GlobalBottomNav from "@/components/pwa/GlobalBottomNav";
import ResponsiveTables from "@/components/pwa/ResponsiveTables";
import "./globals.css";

// next/font self-hosts these at build time — no external font-CDN
// request at runtime, and no layout shift while a webfont loads. See
// tailwind.config.ts for why this specific pairing was chosen.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  // Every child segment's title fills %s, so tabs read "Courses · AAICBI"
  // instead of twenty identical "AAICBI Learning Management System" tabs.
  title: { default: "AAICBI", template: "%s · AAICBI" },
  description:
    "AAICBI, the African AI Capacity Building Initiative: practical AI and technology courses, publicly verifiable certificates and a path to employers.",
  applicationName: "AAICBI",
  appleWebApp: { capable: true, title: "AAICBI", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" }, { url: "/logo.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

// Installable app: the browser bar and the splash screen take the brand colors,
// the page may draw under a phone's notch (the shell then pads itself with the
// safe-area insets), and zooming is left to the user.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#14181A" },
    { media: "(prefers-color-scheme: light)", color: "#016B61" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${manrope.variable}`} suppressHydrationWarning>
      <head>
        {/* Part 8/9 — the centralized theme source of truth, applied
            before first paint so there's no flash of the wrong theme
            and no page-by-page re-implementation. Dark is the DEFAULT:
            only an explicit saved preference of "light" opts out.
            Reads a first-party `theme` cookie (set by the settings
            toggle and synced from a logged-in user's stored
            preference); absent cookie → dark. Kept as a raw inline
            script rather than a React effect precisely because it must
            run before hydration — a useEffect would paint light first,
            then correct, which is the exact flash this avoids.
            suppressHydrationWarning on <html> above is required and
            correct here: the class is intentionally set by this script
            before React attaches, so the server/client class mismatch
            it would otherwise warn about is expected, not a bug. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=document.cookie.match(/(?:^|; )theme=([^;]+)/);var t=m?m[1]:null;if(t!=='light'){document.documentElement.classList.add('dark');}}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />
      </head>
      <body>
        {/* Mounted once, here, so useToast() works from any page in the
            app without every page having to remember to wrap itself. */}
        <ToastProvider>{children}</ToastProvider>
        {/* Analytics System Phase 2 — mounted once, site-wide, same
            reasoning as ToastProvider above: one cookie-consent decision
            per browser, not a per-page concern. */}
        <CookieConsentBanner />
        {/* Platform-wide "page help" button — mounted once, same
            reasoning as the two components above. See
            TourGuideButton.tsx's own comment for why this is a
            fixed-position affordance rather than an element-anchored
            tour. */}
        <TourGuideButton />
        {/* Loop, the ecosystem guide — mounted once, here, like the page
            help button it replaces wherever it shows. See
            src/components/guide/LoopGuide.tsx. */}
        <LoopGuide />
        {/* The installable-app layer: service worker, offline notice, install prompt, and phone-friendly tables. */}
        <PwaRegister />
        <NetworkStatus />
        <InstallPrompt />
        <GlobalBottomNav />
        <ResponsiveTables />
      </body>
    </html>
  );
}
