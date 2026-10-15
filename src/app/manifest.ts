import type { MetadataRoute } from "next";

/**
 * The installed app's identity. One start address (/app) for every kind
 * of account: it opens the feed, and each person reaches their own
 * dashboard from the feed's Dashboard button.
 * Colors match the brand: the teal of the logo, and the dark theme's
 * background (dark is the platform default) behind the splash screen.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "AAICBI",
    short_name: "AAICBI",
    description: "Learn, run training, find talent and opportunities, and stay connected across the AAICBI ecosystem.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#14181A",
    theme_color: "#016B61",
    categories: ["education", "productivity"],
    lang: "en",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Messages", short_name: "Messages", url: "/app?to=messages", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Events", short_name: "Events", url: "/app?to=events", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Notifications", short_name: "Alerts", url: "/app?to=notifications", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
