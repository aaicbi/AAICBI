"use client";
import dynamic from "next/dynamic";

/**
 * The floating extras (Loop, page help, install prompt, offline notice) are not needed for the page to be usable, so they load
 * after it instead of before it. That shrinks the script the phone must run before buttons start answering.
 */
const LoopGuide = dynamic(() => import("@/components/guide/LoopGuide"), { ssr: false });
const TourGuideButton = dynamic(() => import("@/components/TourGuideButton"), { ssr: false });
const InstallPrompt = dynamic(() => import("@/components/pwa/InstallPrompt"), { ssr: false });
const NetworkStatus = dynamic(() => import("@/components/pwa/NetworkStatus"), { ssr: false });

export default function LazyChrome() {
  return (
    <>
      <TourGuideButton />
      <LoopGuide />
      <NetworkStatus />
      <InstallPrompt />
    </>
  );
}
