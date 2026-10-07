import type { SVGProps } from "react";

/**
 * Custom brand icon. Courses: an open book with a bookmark. For course
 * lists and the learning catalogue (LearningPathIcon is the winding
 * path between lessons, used inside a course).
 * Drawn on the shared AAICBI grid: 24px box, 2px stroke, round caps and
 * joins, 2px minimum gap, currentColor so it follows the theme.
 */
export default function CoursesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 7c-1.6-1.8-4.2-2.5-8-2.5V18c3.8 0 6.4.7 8 2.5" />
      <path d="M12 7c1.6-1.8 4.2-2.5 8-2.5V18c-3.8 0-6.4.7-8 2.5" />
      <path d="M12 7v13.5" />
      <path d="M16 4.7v4l1.5-1 1.5 1v-4" />
    </svg>
  );
}
