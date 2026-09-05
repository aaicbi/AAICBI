"use client";
import { useState } from "react";
import OnboardingWalkthrough from "@/components/OnboardingWalkthrough";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";

const STEPS = [
  {
    icon: <GrowthPathDoodle className="h-full w-full" />,
    title: "Welcome to AAICBI",
    description: "A quick look at how to get the most out of your learning here — takes less than a minute.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-full w-full">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
    title: "Continue right where you left off",
    description:
      "Your dashboard always leads with your most recent course — one tap resumes the exact next lesson or assessment, not just the course overview.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-full w-full">
        <rect x="4" y="4" width="16" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 10h16" />
      </svg>
    ),
    title: "Courses unlock as you go",
    description:
      "Each course is broken into modules you complete in order. Finish a module's lessons and assessment to unlock the next.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-full w-full">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
    title: "Notifications keep you in the loop",
    description:
      "A staff reply to your question, a new certificate, an employer's interest — everything real shows up in the bell, top right of every page.",
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
    title: "Earn a certificate, discover opportunities",
    description:
      "Once you pass a course examination, real employers can discover you and job postings open up — you always choose what to share, and when.",
  },
];

export default function TraineeOnboarding({ shouldShow }: { shouldShow: boolean }) {
  const [visible, setVisible] = useState(shouldShow);

  async function complete() {
    setVisible(false);
    await fetch("/api/trainee/onboarding", { method: "POST" }).catch(() => {});
  }

  if (!visible) return null;
  return <OnboardingWalkthrough steps={STEPS} onComplete={complete} />;
}
