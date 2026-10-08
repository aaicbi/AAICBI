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
export function isHiddenPath(pathname: string): boolean {
  const s = segments(pathname);
  const [first, second] = s;
  if (first === "exam") return true;
  if (s.includes("assessment") || s.includes("examination") || s.includes("take")) return true;
  if (first === "trainee" && second === "assignments" && s.length > 2) return true;
  if (first === "trainee" && second === "examinations") return true;
  if (first === "admin") {
    const publicAdmin = ["login", "forgot-password", "reset-password"];
    if (second && publicAdmin.includes(second)) return false;
    return second !== "organization";
  }
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
