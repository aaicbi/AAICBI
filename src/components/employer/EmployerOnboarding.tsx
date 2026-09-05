"use client";
import { useState } from "react";
import OnboardingWalkthrough from "@/components/OnboardingWalkthrough";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";

const STEPS = [
  {
    icon: <GrowthPathDoodle className="h-full w-full" />,
    title: "Welcome, you're approved",
    description: "A quick look at how to find and connect with AAICBI trainees — takes less than a minute.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-full w-full">
        <circle cx="11" cy="11" r="7" strokeLinecap="round" strokeLinejoin="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.3-4.3" />
      </svg>
    ),
    title: "Discover real, vetted trainees",
    description:
      "Browse trainees who've chosen to make themselves discoverable — see their headline, bio, and the certificates they've chosen to share.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-full w-full">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 4h16v12H5.17L4 17.17V4Z"
        />
      </svg>
    ),
    title: "Contact info, only after a real yes",
    description:
      "Express interest, and the trainee decides what to share and when. You'll never see contact details before they've genuinely accepted.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-full w-full">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20 7h-3V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v2H4a1 1 0 0 0-1 1v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a1 1 0 0 0-1-1ZM9 5h6v2H9V5Z"
        />
      </svg>
    ),
    title: "Post a vacancy",
    description:
      "Every posting is screened before publishing, and a real staff member always makes the final call — your listing goes live once approved.",
  },
];

export default function EmployerOnboarding({ shouldShow }: { shouldShow: boolean }) {
  const [visible, setVisible] = useState(shouldShow);

  async function complete() {
    setVisible(false);
    await fetch("/api/employer/onboarding", { method: "POST" }).catch(() => {});
  }

  if (!visible) return null;
  return <OnboardingWalkthrough steps={STEPS} onComplete={complete} />;
}
