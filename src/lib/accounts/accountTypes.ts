/**
 * The five kinds of account a visitor can create, in one place: what each is for, what it can do, what it asks for and
 * what it cannot do. The /join page and the banner on each registration form are built from this, so the words a person
 * reads before signing up and the form they then fill in cannot drift apart. Everything here describes what the platform
 * really does; keep it that way when features change.
 */
export type AccountKey = "trainee" | "organization" | "employer" | "investor" | "startup";

export interface AccountType {
  key: AccountKey;
  name: string;
  /** The label of the button on the /join page. */
  cta: string;
  /** Where its registration form is. */
  href: string;
  /** One line: who it is for. */
  audience: string;
  summary: string;
  can: string[];
  needs: string[];
  limits: string[];
  /** What happens after signing up, in plain words. */
  next: string;
}

export const ACCOUNT_TYPES: AccountType[] = [
  {
    key: "trainee",
    name: "Trainee",
    cta: "Create a Trainee account",
    href: "/trainee/register",
    audience: "Learners, students and professionals building new skills.",
    summary: "Learn, earn certificates anyone can verify, build a profile and be found by employers when you choose.",
    can: [
      "Join courses, take assignments and examinations, and earn verified certificates",
      "Build a profile with your skills and work; it stays private until you choose to make it public",
      "Follow training organizations and search jobs and internships",
      "Write posts and share projects, and join a startup's team",
      "Message employers who reach out to you",
    ],
    needs: ["Your name, email address and a password", "Agreement to the privacy policy", "Email verification"],
    limits: ["Your posts are reviewed by the AAICBI team before they appear, and your training organization can ask for one to be kept off the public feed", "Courses may have their own requirements, such as payment or enrollment"],
    next: "We email you a link to verify your address. After that you can sign in and start.",
  },
  {
    key: "organization",
    name: "Training Organization",
    cta: "Create a Training Organization account",
    href: "/org/register",
    audience: "Institutions, academies, bootcamps and providers that develop digital and professional skills.",
    summary: "Run your programs, show your trainees' work and reach employers, startups and investors.",
    can: [
      "Create an organization profile and public page",
      "Publish courses and training programs, and run events",
      "Share trainee education videos with YouTube links",
      "Manage your own team and your own trainees, and issue certificates",
      "Post updates, follow other members and be followed",
    ],
    needs: ["Organization name, a contact person and an official email address", "A password", "Optional: website and phone number", "Which billing model you prefer (revenue share or direct payment)"],
    limits: ["Applications are reviewed by the AAICBI team before the account is active", "You only ever see your own trainees, staff and records, never another organization's", "Fees are agreed with the AAICBI team after approval"],
    next: "Your application goes to the AAICBI team. You can sign in to see its status while you wait.",
  },
  {
    key: "employer",
    name: "Employer",
    cta: "Create an Employer account",
    href: "/employer/register",
    audience: "Companies, recruitment teams and organizations looking for skilled people.",
    summary: "Publish roles, discover trainees who chose to be visible and reach out to the right people.",
    can: [
      "Create a company profile",
      "Publish jobs and internships once approved",
      "Browse trainees and professionals who made their profile public, and see their verified certificates",
      "Contact candidates through the platform's messaging",
      "Follow training organizations and post company updates",
    ],
    needs: ["Company name and a contact person", "Business email address and a password", "Business registration number and a phone number", "Optional: website and social links"],
    limits: ["Applications are reviewed by the AAICBI team before the account is active", "You only see trainees who chose to be visible, and only what they chose to share"],
    next: "Your application goes to the AAICBI team. You can sign in to see its status while you wait.",
  },
  {
    key: "investor",
    name: "Investor",
    cta: "Create an Investor account",
    href: "/investor/register",
    audience: "Investors, investment firms, angels and venture participants looking for promising businesses and talent.",
    summary: "Discover training organizations, startups and the pitches trainees choose to share.",
    can: [
      "Create an investor profile",
      "Discover training organizations by the skills they teach, and follow them privately",
      "See pitches that trainees choose to share, and startups' public pages",
      "Post announcements once approved",
    ],
    needs: ["Your name and organization", "Email address and a password", "Optional: phone number and LinkedIn address"],
    limits: ["Applications are reviewed by the AAICBI team before the account is active", "Registering does not guarantee funding, returns or access to anything a startup or trainee has not chosen to share"],
    next: "Your application goes to the AAICBI team. You can sign in to see its status while you wait.",
  },
  {
    key: "startup",
    name: "Startup",
    cta: "Create a Startup account",
    href: "/startup/register",
    audience: "Founders and early-stage teams who want visibility, collaborators, talent and investors.",
    summary: "Create your founder account and your startup's profile together, then invite your team.",
    can: [
      "Have a startup profile with your product, stage and what you are looking for",
      "Show up in the startup directory once the AAICBI team approves it",
      "Post updates as the startup, with team members you allow to publish",
      "Invite teammates and decide who can edit and who can publish",
      "Be found by employers, trainees and investors",
    ],
    needs: ["Your name, email address and a password", "Agreement to the privacy policy", "The startup's name; everything else about it can be added later"],
    limits: ["The startup is public only after the AAICBI team approves it, and the verified mark is given by a person", "Do not put confidential material on a public profile; share sensitive pitches only through channels you control", "Your founder account is a member account, so it also has the learning features"],
    next: "We email you a link to verify your address. Then sign in and finish the startup's profile to send it for review.",
  },
];

export function accountType(key: AccountKey): AccountType {
  return ACCOUNT_TYPES.find((a) => a.key === key)!;
}
