import type { SVGProps } from "react";

/**
 * Custom brand icon — for exams/assessments/question banks. A
 * clipboard with a graded checklist, distinct from a plain
 * clipboard-checklist stock icon by pairing two checked rows (graded,
 * not just "a list") — used wherever this app's own exam/assessment
 * concept needs a heading icon (course examinations, module
 * assessments, question banks).
 */
export default function AssessmentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M8 11l1.5 1.5L12 9.5" />
      <path d="M14 11h3" />
      <path d="M8 16l1.5 1.5L12 14.5" />
      <path d="M14 16h3" />
    </svg>
  );
}
