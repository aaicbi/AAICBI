import type { GuideSwitches } from "@/lib/guide/types";

/** Who is looking, from the signed-in session; null when nobody is. */
export type MeKind = "trainee" | "employer" | "investor" | "organization" | "staff";

export interface QuickAction {
  label: string;
  /** Ask the guide this question. */
  ask?: string;
  /** Or go straight to a page. */
  href?: string;
  /** Or explain the page the visitor is on. */
  page?: boolean;
}

export interface PageContext {
  /** A short key for the kind of page, so a hint is not repeated on the same kind of page. */
  key: string;
  greeting: string;
  /** Short hints, shown a few at most per visit. */
  bubbles: string[];
  quick: QuickAction[];
}

function segments(pathname: string): string[] {
  return pathname.split("?")[0].split("#")[0].split("/").filter(Boolean);
}

/**
 * Where Loop never appears. During an exam, assessment or assignment the
 * page is for the trainee's own work, so nothing is offered there. Staff
 * areas have their own help and the Command Center has its own assistant;
 * the organization workspace is the one staff-area exception, because it is
 * where training organizations work.
 */
export function isHiddenPath(pathname: string, me: MeKind | null = null): boolean {
  const s = segments(pathname);
  const [first, second] = s;
  if (first === "exam") return true;
  if (first === "admin") {
    const publicAdmin = ["login", "forgot-password", "reset-password"];
    if (second && publicAdmin.includes(second)) return false;
    if (second === "organization") return false;
    // A training organization authors its courses and assessments here, so Loop stays.
    return me !== "organization";
  }
  if (s.includes("assessment") || s.includes("examination") || s.includes("take")) return true;
  if (first === "trainee" && second === "assignments" && s.length > 2) return true;
  if (first === "trainee" && second === "examinations") return true;
  if (first === "instructor") return true;
  return false;
}

const BASE_QUICK: QuickAction[] = [
  { label: "Show me the ecosystem", href: "/#ecosystem" },
  { label: "Find training", ask: "How do I find a training program?" },
  { label: "Find opportunities", ask: "Where can I find jobs and opportunities?" },
  { label: "Find organizations", ask: "How can I find training organizations?" },
  { label: "How does this platform work?", ask: "How does this platform work?" },
  { label: "Help me create an account", ask: "How do I create an account?" },
];

const ME_QUICK: Record<MeKind, QuickAction[]> = {
  trainee: [{ label: "Go to my dashboard", href: "/trainee/dashboard" }, { label: "Ask my Learning Buddy", href: "/trainee/buddy" }],
  employer: [{ label: "Go to my dashboard", href: "/employer/dashboard" }],
  investor: [{ label: "Go to my dashboard", href: "/investor/dashboard" }],
  organization: [{ label: "Go to my organization", href: "/admin/organization" }],
  staff: [{ label: "Go to my dashboard", href: "/admin/dashboard" }],
};

function available(on: GuideSwitches, a: QuickAction): boolean {
  if (!a.href && !a.ask && !a.page) return false;
  if (a.href === "/jobs") return on.publicJobs;
  if (a.href === "/trainees") return on.publicTrainees;
  if (a.href === "/organizations" || a.href === "/events") return on.orgPages;
  return true;
}

const ORG_GUIDES: QuickAction[] = [
  { label: "Show me around", ask: "Show me around my organization workspace" },
  { label: "Upload a course", ask: "How do I upload a course?" },
  { label: "Add trainees", ask: "How do I add trainees to my course?" },
  { label: "Design certificates", ask: "How do I design certificates with my logo?" },
];

/** Hints and starting actions for a training organization working in its own workspace. */
function orgWorkspaceContext(pathname: string): PageContext {
  const s = segments(pathname);
  const [, second, third] = s;
  const here: QuickAction[] = [];
  const add = (label: string, ask: string) => here.push({ label, ask });
  if (second === "courses") add("Guide me: upload a course", "How do I upload a course?");
  else if (second === "exams" || second === "modules") add("Guide me: module assessment", "How do I set a module assessment?");
  else if (second === "organization" && third === "profile") add("Guide me: public page", "How do I set up my organization's public page?");
  else if (second === "organization" && third === "team") add("Guide me: invite a teammate", "How do I add a teammate to my organization?");
  else if (second === "organization" && third === "events") add("Guide me: post an event", "How do I post an event?");
  else if (second === "organization" && third === "programs") add("Guide me: tag skills", "How do I tag my courses with skills?");
  else if (second === "organization" && third === "insights") add("Guide me: read my numbers", "How do I see how my content is doing?");
  else if (second === "education") add("Guide me: publish a video", "How do I publish a trainee education video?");
  else if (second === "certificate-templates" || second === "training-organizations") add("Guide me: certificates", "How do I design certificates with my logo?");
  else if (second === "payments") add("Guide me: payments and reports", "Where do I see payments and download reports?");
  return {
    key: "org-workspace",
    greeting: "Hi, I'm Loop. I can walk you through your workspace step by step: uploading a course, adding trainees, certificates and more. What would you like to do?",
    bubbles: ["Want me to walk you through your workspace?", "Need to upload a course? I can show you step by step."],
    quick: [...here, ...ORG_GUIDES],
  };
}

const TRAINEE_GUIDES: QuickAction[] = [
  { label: "Show me around", ask: "Show me around my trainee dashboard" },
  { label: "Enroll in a course", ask: "How do I enroll in a course?" },
  { label: "Learn through a course", ask: "How do I take lessons and unlock the next module?" },
  { label: "Get my certificate", ask: "How do I take the course examination and earn a certificate?" },
];

/** Hints and starting actions for a signed-in trainee working in their own area. */
function traineeWorkspaceContext(pathname: string): PageContext {
  const [, second] = segments(pathname);
  const here: QuickAction[] = [];
  const add = (label: string, ask: string) => here.push({ label, ask });
  if (second === "courses") add("Guide me: enroll and learn", "How do I enroll in a course?");
  else if (second === "examinations") add("Guide me: take an assessment", "How do I take a module assessment?");
  else if (second === "assignments") add("Guide me: do an assignment", "How do I do and submit an assignment?");
  else if (second === "certificates") add("Guide me: share my certificate", "How do I share or print my certificate?");
  else if (second === "profile") add("Guide me: who sees my profile", "How do I set up my profile and choose who can see it?");
  else if (second === "job-postings" || second === "introductions") add("Guide me: jobs and introductions", "How do I answer an employer introduction?");
  else if (second === "messages") add("Guide me: get help", "How do I message my instructor or get help?");
  else if (second === "explore") add("Guide me: explore", "How do I explore the ecosystem and see job listings?");
  else if (second === "videos") add("Guide me: post a video", "How do I post my video and send it to my training organization?");
  else if (second === "report") add("Guide me: report a concern", "How do I report an abusive training organization?");
  else if (second === "settings") add("Guide me: my settings", "How do I change my settings and notifications?");
  return {
    key: "trainee-workspace",
    greeting: "Hi, I'm Loop. I can walk you through the platform step by step: joining a course, lessons, assessments, assignments, your certificate and more. What would you like to do?",
    bubbles: ["New here? I can show you around step by step.", "Want a hand with your course? Ask me."],
    quick: [...here, ...TRAINEE_GUIDES],
  };
}

/** Hints and starting actions for the page someone is on, tuned a little for who they are. */
export function contextFor(pathname: string, on: GuideSwitches, me: MeKind | null = null): PageContext {
  const [first, second] = segments(pathname);
  let ctx: PageContext;

  if (!first) {
    ctx = {
      key: "home",
      greeting: "Hi, I'm Loop. I can show you around the ecosystem, or take you straight to what you're looking for.",
      bubbles: ["I can show you around.", "Looking for training or an opportunity?", "Want to see what's happening here?"],
      quick: BASE_QUICK,
    };
  } else if (first === "courses") {
    ctx = {
      key: "training",
      greeting: "Looking for a program? Tell me a skill you want to build and I'll show you where to look.",
      bubbles: ["I can help you find a program based on the skills you want to develop.", "Not sure where to start? Ask me."],
      quick: [
        { label: "Find a program by skill", ask: "How do I find a training program?" },
        { label: "Is it free to join?", ask: "Is it free to join?" },
        { label: "How do I get a certificate?", ask: "How do I get a certificate?" },
        { label: "Help me create an account", ask: "How do I create an account?" },
      ],
    };
  } else if (first === "jobs") {
    ctx = {
      key: "opportunities",
      greeting: "Looking for your next opportunity? Tell me a skill and I'll show you where to look.",
      bubbles: ["Looking for your next opportunity? Tell me a skill and I'll search for it.", "Need to know how applying works?"],
      quick: [
        { label: "How do I apply for a job?", ask: "How do I apply for a job?" },
        { label: "Help me create an account", ask: "How do I create an account?" },
        { label: "Find training", ask: "How do I find a training program?" },
      ],
    };
  } else if (first === "organizations") {
    ctx = {
      key: "organizations",
      greeting: "Looking for a training organization? I can help you explore the ones on the platform.",
      bubbles: ["Looking for a training organization? I can help you explore them.", "Do you run training yourself? Ask me how to list it."],
      quick: [
        { label: "How do I follow an organization?", ask: "How do I follow an organization?" },
        { label: "How do I become a training organization?", ask: "How do I become a training organization?" },
        { label: "How does an organization get featured?", ask: "How does an organization get featured?" },
      ],
    };
  } else if (first === "trainees") {
    ctx = {
      key: "trainees",
      greeting: "These are people who chose to share their profile. I can tell you how employers can take part.",
      bubbles: ["Hiring? I can show you how employers take part.", "Want your own profile here? Ask me how."],
      quick: [
        { label: "How can employers take part?", ask: "How can employers take part?" },
        { label: "Who can see my profile?", ask: "Who can see my profile?" },
        { label: "Help me create an account", ask: "How do I create an account?" },
      ],
    };
  } else if (first === "learn" || first === "feed" || first === "events" || first === "search" || first === "showcase") {
    const what = first === "events" ? "events" : first === "search" ? "search" : "videos and updates";
    ctx = {
      key: `explore-${first}`,
      greeting: `Want a hand with ${what}? Ask me, or pick one of these.`,
      bubbles: ["Want to see what's happening across the ecosystem?"],
      quick: [
        { label: "Show me the ecosystem", href: "/#ecosystem" },
        { label: "Find training", ask: "How do I find a training program?" },
        { label: "Find opportunities", ask: "Where can I find jobs and opportunities?" },
      ],
    };
  } else if (first === "certificate") {
    ctx = {
      key: "certificate",
      greeting: "Checking a certificate? Enter its code on this page. I can explain how it works.",
      bubbles: [],
      quick: [
        { label: "How do I verify a certificate?", ask: "How do I verify a certificate?" },
        { label: "How do I get a certificate?", ask: "How do I get a certificate?" },
      ],
    };
  } else if (["login", "register", "forgot-password", "reset-password", "verify"].includes(second ?? "") || (first === "admin" && second === "login")) {
    ctx = {
      key: "account",
      greeting: "Need a hand getting in? Ask me, or pick one of these.",
      bubbles: [],
      quick: [
        { label: "I forgot my password", ask: "I forgot my password" },
        { label: "How do I create an account?", ask: "How do I create an account?" },
        { label: "How do I sign in?", ask: "How do I sign in?" },
      ],
    };
  } else if (first === "trainee" && me === "trainee") {
    ctx = traineeWorkspaceContext(pathname);
  } else if (first === "trainee") {
    ctx = {
      key: "trainee-area",
      greeting: "Need help finding something? I can point you to the right page.",
      bubbles: ["Need help finding your way around?"],
      quick: [
        { label: "Find training", href: "/courses" },
        { label: "Find opportunities", ask: "Where can I find jobs and opportunities?" },
        { label: "Who can see my profile?", ask: "Who can see my profile?" },
      ],
    };
  } else if (first === "employer") {
    ctx = {
      key: "employer-area",
      greeting: "Need help finding something? I can point you to the right page.",
      bubbles: ["Need help posting a role or finding talent?"],
      quick: [
        { label: "How do I post a job?", ask: "How do I post a job or opportunity?" },
        { label: "Explore trainees", ask: "Where can I see trainees and their skills?" },
      ],
    };
  } else if (first === "investor") {
    ctx = {
      key: "investor-area",
      greeting: "Need help finding something? I can point you to the right page.",
      bubbles: ["Looking for organizations to follow?"],
      quick: [
        { label: "How can investors take part?", ask: "How can investors take part?" },
        { label: "Find organizations", ask: "How can I find training organizations?" },
      ],
    };
  } else if (first === "admin" && me === "organization") {
    ctx = orgWorkspaceContext(pathname);
  } else if (first === "admin" || first === "org") {
    ctx = {
      key: "organization-area",
      greeting: "Need help? I can answer questions about what a training organization can do here.",
      bubbles: ["Want to know what your organization can do here?"],
      quick: [
        { label: "What can a training organization do?", ask: "What can a training organization do here?" },
        { label: "How does an organization get featured?", ask: "How does an organization get featured?" },
        { label: "How can I find trainees?", ask: "Where can I see trainees and their skills?" },
      ],
    };
  } else {
    ctx = { key: "general", greeting: "Hi, I'm Loop. Ask me anything about finding your way around.", bubbles: [], quick: BASE_QUICK };
  }

  const extra = me ? ME_QUICK[me] : [];
  const aboutThisPage: QuickAction[] = ctx.key === "home" ? [] : [{ label: "What can I do on this page?", page: true }];
  const quick = [...extra, ...aboutThisPage, ...ctx.quick].filter((a) => available(on, a)).slice(0, 6);
  return { ...ctx, quick };
}
