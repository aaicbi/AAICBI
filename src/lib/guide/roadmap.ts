import { link } from "@/lib/guide/links";
import type { GuideEntry } from "@/lib/guide/types";

/**
 * Loop's knowledge of how to get around and what to do next: a roadmap for each kind of account, and how-to answers for the
 * things people ask for most, written from the platform's own documents (docs/*.md) and kept to what the platform does today.
 * Where an answer is about a page, `nav` gives the "Take me there" button (checked against the account's access, so nobody is
 * sent to a page they cannot open) and `target` lights up the control. Every page of the platform is in src/lib/guide/siteMap.ts;
 * this file is the part that explains how the pieces fit together.
 *
 * No prices, dates or numbers: those live on the pages and change.
 */
interface Opts {
  nav?: [href: string, label?: string];
  target?: string;
  links?: Array<[href: string, label?: string]>;
  keywords?: string[];
  roles?: string[];
  related?: string[];
  category?: string;
}

const g = (id: string, question: string, answer: string, o: Opts = {}): GuideEntry => ({
  id: `default:${id}`,
  question,
  answer,
  links: (o.links ?? []).map(([h, l]) => link(h, l)),
  keywords: o.keywords ?? [],
  source: "default",
  navHref: o.nav?.[0] ?? null,
  navLabel: o.nav?.[1] ?? null,
  target: o.target ?? null,
  roles: o.roles ?? [],
  relatedQuestions: o.related ?? [],
  category: o.category ?? "Roadmap",
});

export const ROADMAP_ENTRIES: GuideEntry[] = [
  // ---------------------------------------------------------------- roadmaps
  g("roadmap-member", "What is the roadmap for a new member?",
    "First create a free member account and confirm your email. Then add a photo and a few skills to your profile (it is public by default so people can find you, and you can make it private). Browse programs and enrol, study the lessons, pass each module assessment and the course examination, and earn a certificate anyone can verify. Write posts about what you learn, follow organizations and startups, and apply for jobs. Your dashboard shows what to do next.",
    { nav: ["/trainee/dashboard", "Open my dashboard"], links: [["/trainee/register"], ["/courses"], ["/jobs"]], keywords: ["member roadmap", "member journey", "get started", "first steps", "what do i do first", "path"], roles: [] }),
  g("roadmap-org", "What is the roadmap for a training organization?",
    "First register your organization and wait for approval. Fill in your public profile and switch it on. Create a course with modules, lessons, assessments and an examination, set a price or keep it free, and publish. Design your certificate in the Certificate studio, invite your team and give each person a role, then announce events, publish trainee videos and write posts so people find you.",
    { nav: ["/admin/organization", "Open my workspace"], links: [["/org/register"], ["/organizations"]], keywords: ["organization roadmap", "organisation roadmap", "academy journey", "provider journey", "set up my organization", "get started as an organization", "what do i do first"], roles: [] }),
  g("roadmap-employer", "What is the roadmap for an employer?",
    "First register as an employer and wait for approval. Complete your company profile (public by default). Post jobs, which are reviewed before they go live. Discover trainees by skill and ask for an introduction, which they choose whether to accept. Read applications, message the people you want, and write posts to show your company.",
    { nav: ["/employer/dashboard", "Open my dashboard"], links: [["/employer/register"], ["/jobs"]], keywords: ["employer roadmap", "recruiter journey", "hire talent", "get started as an employer", "what do i do first"], roles: [] }),
  g("roadmap-investor", "What is the roadmap for an investor?",
    "First register as an investor and wait for approval. Browse investment opportunities and approved startups, look at the pitches and teasers founders chose to share, and ask to see more; founders decide what to disclose. Investor profiles are not public.",
    { nav: ["/investor/dashboard", "Open investment opportunities"], links: [["/investor/register"], ["/startups"]], keywords: ["investor roadmap", "invest journey", "get started as an investor", "what do i do first"], roles: [] }),
  g("roadmap-founder", "What is the roadmap for a startup founder?",
    "First create a founder account, which also creates your draft startup. Fill in the problem, solution, stage and what you are looking for, then submit it for review; once approved it is public. Invite teammates and choose what each may edit or publish, post as your startup, and share your project in the community showcase. When you are ready, create a pitch for investors.",
    { nav: ["/trainee/startups", "Open my startups"], links: [["/startup/register"], ["/startups"]], keywords: ["founder roadmap", "startup journey", "start a startup", "get started as a founder", "what do i do first", "venture"], roles: [] }),
  g("roadmap-staff", "What is the roadmap for the AAICBI team?",
    "Approve organizations, employers, investors, startups and jobs; keep the review inbox moving (most posts publish automatically, the review inbox holds the ones that need a person); handle reports and handle-change requests; watch the Command Center; and keep Loop's answers current. Super admins also control the public ecosystem switches and where payments go for a moved course.",
    { nav: ["/admin/dashboard", "Open the dashboard"], keywords: ["staff roadmap", "admin journey", "team roadmap", "super admin duties", "what do admins do"], roles: ["staff"] }),
  g("where-start", "Where do I start?",
    "Tell me how you will use the platform and I'll show the roadmap: as a member (learner), a training organization, an employer, an investor or a startup founder. If you are not sure, the page that compares the five account types will help.",
    { links: [["/join"], ["/courses"], ["/feed"]], keywords: ["start", "begin", "first", "lost", "confused", "overview", "what can i do", "guide me", "help", "no idea"] }),
  g("whole-map", "Show me everything I can open",
    "Here is every place your account can go, grouped. I'll list them for you now. Tap any to go there.",
    { keywords: ["site map", "sitemap", "all pages", "list of pages", "every page", "where can i go", "menu", "what pages are there", "navigate", "directory", "everything on the platform"] }),

  // ---------------------------------------------------------------- the feed and posting
  g("write-post", "How do I write a post?",
    "Press the round plus button (the Post button on the bottom bar on a phone, or Write a post in the menu or the feed header). Write something, add up to a few pictures or a YouTube link, add #topics, and send it. Posts are checked automatically: a clean post is published straight away, and anything unusual goes to the AAICBI team for a second look first. Everyone who is signed in can post, as themselves, as their startup, or as their organization.",
    { nav: ["/compose", "Write a post"], links: [["/feed"]], keywords: ["post", "publish", "share", "write", "create a post", "new post", "make a post", "tweet", "status", "update"] }),
  g("post-not-showing", "Why is my post not showing in the feed?",
    "Open My posts to see where it stands. Published means it is live. Waiting for review means the team is taking a second look (for example it had several links or contact details); you will be told the result. Changes requested means a reviewer asked for an edit. If a post says published but you cannot see it, a members-only post is hidden from visitors, and the feed can take a minute to refresh.",
    { nav: ["/my-posts", "Open My posts"], keywords: ["post missing", "post not visible", "pending", "waiting for review", "where is my post", "not published", "rejected", "held", "approval"] }),
  g("post-review", "How does the automatic post review work?",
    "Every post is read automatically when you send it. If nothing looks wrong it is published at once. If it shows warning signs (abuse, scams, adult content, many links, shared email or phone numbers, shouting, repeating a recent post) it goes to the review inbox with the reasons, and a person decides. Members with a good record and nothing taken down publish instantly unless a post shows serious signs. People can also report any post.",
    { keywords: ["moderation", "review", "approve", "auto review", "trusted", "automatic", "rules", "community rules", "report a post"] }),
  g("react-comment", "How do I react, comment, follow or save a post?",
    "Open the feed or a post. The buttons under a post let you react, comment, save and share; the Follow button next to a name follows that person, organization or startup. You need an account for these (reading is open to everyone). Saved posts are kept in Saved posts, and Following shows only the people you follow.",
    { nav: ["/saved", "Open saved posts"], links: [["/feed"]], keywords: ["like", "reaction", "comment", "follow", "save", "bookmark", "share", "reply", "react"] }),
  g("feed-topics", "How do topics and the Following tab work?",
    "Put #topics in a post and people can tap them to see everything on that topic. 'Topics this week' on the feed shows what several different people are posting about. The Following tab shows only posts from the people, organizations and startups you follow; Discover shows who and what to explore.",
    { links: [["/feed"]], keywords: ["hashtag", "topic", "trending", "following", "discover", "tag", "#"] }),
  g("showcase-feed", "How do I show a project in the community showcase?",
    "On your profile, add a project and choose to list it in the community showcase. A clean project is approved automatically; anything else waits for a reviewer. Once it is in the showcase it also appears in the feed as a post, and it comes down from the feed if you take it out.",
    { nav: ["/trainee/profile", "Open my profile"], links: [["/showcase"]], keywords: ["showcase", "project", "portfolio", "demo", "show my work", "list project"], roles: ["trainee"] }),

  // ---------------------------------------------------------------- finding people and things
  g("find-person", "How do I find a person or a user?",
    "Use the search bar at the top, or open Search and choose People. You can search by name or @handle. Everyone who has confirmed their email can be found by name; what they have filled in (place, skills, work) shows only if their profile is public, which is the default. You can also search comments, posts, organizations, employers, startups, jobs, programs, videos and events.",
    { links: [["/search"], ["/trainees"]], keywords: ["find user", "find someone", "look for a person", "search for a member", "find my friend", "find a trainee", "who is", "user", "member", "handle", "username", "people"] }),
  g("search-what", "What can I search for?",
    "People and organizations (by name or @handle), employers, startups, open jobs, public programs, posts and the comments under them, education videos and events. Pick a type to filter by skill, place, industry or post type, sort by best match or newest, and share the address of any search. Super admins, staff and private messages are never searched.",
    { links: [["/search"]], keywords: ["search", "find", "look up", "filter", "comments", "posts", "everything", "all encompassing"] }),
  g("handle-change", "How do I change my @handle or username?",
    "Your @handle is your public address on the platform. To change it, send a request from your profile; a super admin reviews it. Your old address keeps working and still finds you in search.",
    { nav: ["/trainee/profile", "Open my profile"], keywords: ["handle", "username", "rename", "change my name", "my address", "@"], roles: ["trainee"] }),

  // ---------------------------------------------------------------- profile visibility
  g("profile-private", "How do I make my profile private?",
    "Your profile is public by default so people can find you. Open My profile, find Profile visibility and choose who may see it: Public, any signed-in account, approved employers only, or Private (only you and admins). Even when it is private, your name and photo can still be found in search, because they already appear on your posts; your place, skills, education, work and links stay hidden. Contact details are never shown publicly.",
    { nav: ["/trainee/profile", "Open my profile"], target: "profile-visibility", keywords: ["private", "hide my profile", "make private", "visibility", "who can see me", "privacy setting", "hide", "public", "not public"], roles: ["trainee"] }),
  g("company-profile-private", "How do I change who can see my company profile?",
    "Your company profile is public by default so candidates and members can find you. Open Company profile, find Profile visibility and choose who may see it. Your company name can still be found in search; nothing else is on a private page.",
    { nav: ["/employer/profile", "Open company profile"], target: "company-profile-visibility", keywords: ["private", "hide", "visibility", "company page", "who can see"], roles: ["employer"] }),

  // ---------------------------------------------------------------- learning
  // ---------------------------------------------------------------- notifications, messages, app
  g("notifications", "Where are my notifications?",
    "Tap the bell (or Alerts in More on a phone). It lists replies, decisions on your posts, messages and updates, and you can mark them all as read. Long ones show 'See more'. Turn on push notifications there to get them on your phone.",
    { nav: ["/notifications", "Open notifications"], keywords: ["alerts", "bell", "notification", "push", "unread", "updates"] }),
  g("move-loop", "Loop is covering a button. Can I move it?",
    "Yes. Drag the round Loop button anywhere on the screen and it stays there (Alt with the arrow keys also moves it). Open Loop and choose 'Put Loop back' to return it to its corner.",
    { keywords: ["loop in the way", "blocking", "covering", "move loop", "hide loop", "drag", "button hidden"] }),
  g("install-app", "How do I install the app on my phone?",
    "Open the platform in your phone's browser and choose Add to Home Screen (or the Install app button in the menu). It then opens like an app, works with a poor connection for pages you have visited, and can send push notifications.",
    { links: [["/#ecosystem"]], keywords: ["install", "app", "add to home screen", "phone app", "download the app", "pwa", "offline"] }),

  // ---------------------------------------------------------------- organizations and the team
  g("org-team-roles", "How do I invite my team and set what each person can do?",
    "Open Team. Invite a colleague by email and choose their role: Manager (everything except billing), Editor (builds and edits content and posts, but cannot publish, delete, or change the team or profile) or Viewer (can look but not change). Everyone signs in as themselves, you can change or remove a role at any time and it takes effect straight away, and Recent activity shows who changed what.",
    { nav: ["/admin/organization/team", "Open the team page"], keywords: ["team", "teammate", "colleague", "invite", "role", "manager", "editor", "viewer", "permissions", "staff accounts", "who can edit", "activity"], roles: ["organization"] }),
  g("share-collaborate", "How do I work on a course with a colleague or another organization?",
    "Open the course (or examination, or assignment) and use 'Work on this together' to make an invite link. Send it; they sign in as staff, instructor or organization, open it, and join as an editor. Editors change the content; publishing, pricing, deleting and sharing stay with the owner. The owner of a course can also make a copy link that gives another organization its own independent copy to run. Links last a week, can be cancelled, and are shown only once.",
    { nav: ["/admin/courses", "Open courses"], keywords: ["share", "collaborate", "co-author", "invite editor", "share a course", "copy a course", "work together", "link", "another organization"], roles: ["organization", "staff"] }),
  g("org-events-videos", "How do I announce an event or publish a video?",
    "Events: open Events, add the title, date and place, and it appears on your public page and the events page. Videos: open Education videos to publish videos presented by your trainees (they approve first). Both help people discover your organization.",
    { nav: ["/admin/organization/events", "Open events"], links: [["/events"], ["/learn"]], keywords: ["event", "video", "announce", "webinar", "publish video", "education video"], roles: ["organization"] }),
  // ---------------------------------------------------------------- startups
  g("startup-create", "How do I create or manage my startup profile?",
    "Create a startup account (or, if you are a member, start one from My startups). Fill in what you build, the problem, your stage and what you are looking for, then submit it for review; once approved it is public and searchable. From My startups you can invite teammates and choose what each may edit or publish, and post as the startup.",
    { nav: ["/trainee/startups", "Open my startups"], links: [["/startup/register"], ["/startups"]], keywords: ["startup", "founder", "company", "venture", "team", "stage", "seeking", "funding"], roles: [] }),

  // ---------------------------------------------------------------- the AAICBI team
  g("staff-review", "Where is the review inbox for held posts?",
    "Open the Review inbox. It lists posts waiting for a person, with the reasons they were held (the automatic reviewer explains), and Loop's unanswered questions. Approve, ask for changes, or reject with a reason the author will read. Reports and handle-change requests have their own pages.",
    { nav: ["/admin/review", "Open the review inbox"], keywords: ["review", "approve post", "moderate", "reports", "inbox", "held posts", "reject post"], roles: ["staff"] }),
  g("staff-move-course", "How do I move a course to a training organization and decide where payments go?",
    "Super admins only: open the course and use 'Owner of this course'. Choose the organization and move it; its assessments, examination and assignments go with it. For a paid course you must choose where new payments go: follow the organization's billing setup, or AAICBI keeps the whole payment. You can change that later on the same page.",
    { nav: ["/admin/courses", "Open courses"], keywords: ["move course", "transfer course", "payments", "revenue share", "payout", "owner", "reassign"], roles: ["staff"] }),
  g("staff-switches", "How do I turn parts of the public platform on or off?",
    "Super admins open Public ecosystem switches: organization pages, education videos, the feed, the public job board and the public trainee list can each be switched off, and the home page falls back to the earlier landing page if the feed is off.",
    { nav: ["/admin/ecosystem", "Open the switches"], keywords: ["switch", "turn off", "disable", "feature flag", "feed off", "hide jobs"], roles: ["staff"] }),
];
