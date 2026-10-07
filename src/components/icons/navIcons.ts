import type { ComponentType, SVGProps } from "react";
import { Download, LayoutGrid } from "lucide-react";
import {
  AchievementIcon,
  AssessmentIcon,
  AssignmentsIcon,
  BriefcaseIcon,
  CertificateIcon,
  CohortIcon,
  CoursesIcon,
  DashboardIcon,
  InsightsIcon,
  LoopIcon,
  MessagesIcon,
  OrganizationIcon,
  PaymentsIcon,
  ReportsIcon,
  RocketIcon,
  SettingsIcon,
  ShowcaseIcon,
  TeamIcon,
} from "@/components/icons/brand";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * One icon per destination, shared by every role's sidebar so the same
 * idea has the same picture everywhere (Settings is the same sliders
 * for a trainee, an employer and an administrator). Keyed by the part of
 * the path after the role, so /admin/courses and /instructor/courses
 * share one entry. Anything unlisted falls back to a neutral grid
 * rather than showing nothing, which keeps the labels aligned.
 */
const BY_PATH: Record<string, IconComponent> = {
  "/dashboard": DashboardIcon,
  "/courses": CoursesIcon,
  "/exams": AssessmentIcon,
  "/examinations": AssessmentIcon,
  "/assignments": AssignmentsIcon,
  "/certificates": CertificateIcon,
  "/certificate-templates": CertificateIcon,
  "/progress": AchievementIcon,
  "/my-activity": InsightsIcon,
  "/messages": MessagesIcon,
  "/buddy": LoopIcon,
  "/downloads": Download,
  "/settings": SettingsIcon,
  "/organization": OrganizationIcon,
  "/organization/team": TeamIcon,
  "/training-organizations": OrganizationIcon,
  "/instructors": TeamIcon,
  "/agreement-templates": ReportsIcon,
  "/agreement": ReportsIcon,
  "/materials": ReportsIcon,
  "/staff": TeamIcon,
  "/performance": InsightsIcon,
  "/analytics": InsightsIcon,
  "/payments": PaymentsIcon,
  "/showcase": ShowcaseIcon,
  "/pitches": RocketIcon,
  "/pitch-cohorts": CohortIcon,
  "/investors": PaymentsIcon,
  "/command": LoopIcon,
  "/design-system": ShowcaseIcon,
  "/discover": TeamIcon,
  "/introductions": MessagesIcon,
  "/job-postings": BriefcaseIcon,
  "/status": OrganizationIcon,
};

export function getNavIcon(href: string): IconComponent {
  // The investor's home is a list of opportunities, not a dashboard.
  if (href === "/investor/dashboard") return RocketIcon;
  const path = href.replace(/^\/(admin|trainee|instructor|employer|investor)/, "");
  return BY_PATH[path] ?? LayoutGrid;
}
