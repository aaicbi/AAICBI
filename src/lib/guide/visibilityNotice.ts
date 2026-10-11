/**
 * The one-time notice Loop gives a member or employer whose profile is public: that it is, what people can see, and how to
 * make it private. No database, so it can be tested. Whether to show it is decided on the server from the account itself
 * (public, and never told), so it follows the person across devices and is shown once.
 */
export type NoticeKind = "trainee" | "employer";

export interface VisibilityNotice {
  show: boolean;
  kind: NoticeKind;
  text: string;
  /** The page with the control, the control to light up, and the buttons' labels. */
  href: string;
  target: string;
  showLabel: string;
  keepLabel: string;
}

export function shouldShowNotice(a: { visibility: string; noticeAt: Date | null }): boolean {
  return a.visibility === "PUBLIC" && a.noticeAt === null;
}

export function noticeFor(kind: NoticeKind, a: { visibility: string; noticeAt: Date | null }): VisibilityNotice {
  const member = kind === "trainee";
  return {
    show: shouldShowNotice(a),
    kind,
    text: member
      ? "Your profile is public, so people can find you by name and see your skills, education, work and projects. Your contact details are never shown. You can make it private any time."
      : "Your company profile is public, so candidates and members can find you by name. You can make it private any time.",
    href: member ? "/trainee/profile" : "/employer/profile",
    target: member ? "profile-visibility" : "company-profile-visibility",
    showLabel: "Show me how to make it private",
    keepLabel: "Keep it public",
  };
}
