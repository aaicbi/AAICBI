/** Which stored pictures can be shrunk, how wide each kind may be, and when a picture is worth shrinking. Pure, so it can be tested. */

export type PictureKind = "USER_AVATAR" | "TRAINEE_AVATAR" | "ORG_LOGO" | "EMPLOYER_LOGO" | "STARTUP_LOGO" | "COURSE_FLYER" | "ORG_COVER";

/** The widest each kind of picture is ever shown (a little over, for sharp screens). Matches what the picture editor now saves. */
export const MAX_WIDTH: Record<PictureKind, number> = {
  USER_AVATAR: 480, TRAINEE_AVATAR: 480, ORG_LOGO: 480, EMPLOYER_LOGO: 480, STARTUP_LOGO: 480, COURSE_FLYER: 1280, ORG_COVER: 1600,
};
export const KIND_LABEL: Record<PictureKind, string> = {
  USER_AVATAR: "Staff profile pictures", TRAINEE_AVATAR: "Trainee profile pictures", ORG_LOGO: "Organization logos", EMPLOYER_LOGO: "Employer logos",
  STARTUP_LOGO: "Startup logos", COURSE_FLYER: "Course flyers", ORG_COVER: "Organization covers",
};
export const KINDS = Object.keys(MAX_WIDTH) as PictureKind[];

/** A picture under this size is left alone: shrinking it would save almost nothing. */
export function worthChecking(kind: PictureKind, bytes: number): boolean {
  const floor = kind === "COURSE_FLYER" || kind === "ORG_COVER" ? 250 * 1024 : 60 * 1024;
  return bytes > floor;
}

/** The new file is used only when it is clearly smaller than the old one. */
export function worthReplacing(oldBytes: number, newBytes: number): boolean {
  return newBytes > 0 && newBytes <= oldBytes * 0.85;
}

export const prettyBytes = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(0, Math.round(n / 1024))} KB`);
