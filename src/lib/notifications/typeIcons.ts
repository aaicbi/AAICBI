import {
  Bell,
  Unlock,
  ClipboardCheck,
  Award,
  AlertTriangle,
  XCircle,
  Clock,
  CreditCard,
  FileText,
  MessageCircle,
  CheckCircle2,
  Megaphone,
  Mail,
  Rocket,
  BarChart3,
  Sparkles,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

/**
 * Dashboard/Examination redesign — a purely presentational
 * NotificationType → icon mapping, so the bell dropdown and the full
 * notifications list show a relevant icon instead of being text-only.
 * No backend change: GET /api/notifications and the /notifications
 * page both already return the full UserNotification row (including
 * `type`), just not previously read client-side. Not exhaustive for
 * every rare staff-only type — anything unmapped falls back to a plain
 * bell, which is always a reasonable default, never a broken icon.
 */
const TYPE_ICON: Record<string, LucideIcon> = {
  WELCOME: Sparkles,
  MODULE_UNLOCKED: Unlock,
  COURSE_ACCESS_GRANTED: Unlock,
  EXAM_ACCESS_GRANTED: Unlock,
  ASSESSMENT_RESULT: ClipboardCheck,
  CERTIFICATE_ISSUED: Award,
  EXAM_CERTIFICATE_ISSUED: Award,
  EARLY_WARNING_STAFF: AlertTriangle,
  EARLY_WARNING_TRAINEE: AlertTriangle,
  LIKELY_DUPLICATE_PAYMENT: AlertTriangle,
  PAYMENT_FAILED: XCircle,
  EMPLOYER_REJECTED: XCircle,
  JOB_POSTING_REJECTED: XCircle,
  INVESTOR_REJECTED: XCircle,
  PITCH_REJECTED: XCircle,
  PITCH_NEEDS_REVISION: XCircle,
  SUBSCRIPTION_ENDING: Clock,
  SUBSCRIPTION_ENDED: Clock,
  ACCESS_EXPIRING_REMINDER: Clock,
  SUBSCRIPTION_RENEWING_REMINDER: Clock,
  NEW_EMPLOYER_PENDING: Clock,
  NEW_JOB_POSTING_PENDING: Clock,
  NEW_INVESTOR_PENDING: Clock,
  PAYMENT_RECEIPT: CreditCard,
  MATERIAL_UPDATED: FileText,
  QA_REPLY: MessageCircle,
  MESSAGE_TO_ADMIN: Mail,
  EMPLOYER_APPROVED: CheckCircle2,
  JOB_POSTING_APPROVED: CheckCircle2,
  INVESTOR_APPROVED: CheckCircle2,
  PITCH_APPROVED: CheckCircle2,
  PITCH_PUBLISHED: CheckCircle2,
  INTRODUCTION_REQUEST: Mail,
  INTRODUCTION_RESPONSE: Mail,
  STAFF_ACCOUNT_CREATED: UserPlus,
  INSTRUCTOR_AGREEMENT_SENT: UserPlus,
  INSTRUCTOR_AGREEMENT_ACCEPTED: UserPlus,
  COURSE_INSTRUCTOR_ASSIGNED: UserPlus,
  INVESTOR_ACCOUNT_CREATED: UserPlus,
  LOOP_BROADCAST: Megaphone,
  PITCH_SUBMITTED: Rocket,
  PITCH_DISCLOSURE_REQUESTED: Rocket,
  PITCH_DISCLOSURE_RESPONSE: Rocket,
  PITCH_INTEREST_RECEIVED: Rocket,
  ANALYTICS_ALERT: BarChart3,
  ANALYTICS_REPORT: BarChart3,
};

export function notificationIconFor(type: string): LucideIcon {
  return TYPE_ICON[type] ?? Bell;
}
