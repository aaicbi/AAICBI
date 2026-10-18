import type { Audience } from "@/lib/guide/navigation";

/**
 * The whole platform on one page: every page a person can open, what it is for, and who may open it. Loop uses it to take
 * someone anywhere ("Take me there"), to answer "where do I find ...", and to list everything a given kind of account can
 * do. A test (tests/guideSiteMap.test.ts) walks the app's folders and fails when a page is added, moved or removed without
 * this list following, so Loop's knowledge of the platform cannot quietly go out of date.
 *
 * Wording rules: say what the page does today in plain words; no prices, dates or numbers (they live on the pages).
 */
export interface SitePage {
  href: string;
  label: string;
  who: Audience[];
  /** What the page is for, in one sentence. */
  what: string;
  /** What people call it, so "where is my certificate" and "download certificate" both find it. */
  aliases?: string[];
}

export type Group = "Everyone" | "Join and sign in" | "Member (trainee)" | "Employer" | "Investor" | "Training organization" | "AAICBI team" | "Instructor";

const ANY: Audience[] = ["any"];
const IN: Audience[] = ["signedIn"];
const ORGSTAFF: Audience[] = ["organization", "staff"];
const STAFF: Audience[] = ["staff"];

export const PAGES: Array<SitePage & { group: Group }> = [
  // ---- Everyone (no account needed)
  { group: "Everyone", href: "/", label: "Home and community feed", who: ANY, what: "The front page: the community feed anyone can read, with search, trending topics and who to follow.", aliases: ["home", "homepage", "front page", "main page", "start"] },
  { group: "Everyone", href: "/feed", label: "Community feed", who: ANY, what: "Posts from members, organizations and startups. Read without an account; react, comment, follow and save with one.", aliases: ["feed", "posts", "timeline", "community", "what is new"] },
  { group: "Everyone", href: "/about", label: "About AAICBI", who: ANY, what: "What AAICBI is, how the ecosystem works, and who it is for.", aliases: ["about", "about us", "what is aaicbi", "mission"] },
  { group: "Everyone", href: "/search", label: "Search the ecosystem", who: ANY, what: "Find people, organizations, employers, startups, jobs, programs, posts, comments, videos and events, with filters.", aliases: ["search", "find a person", "find someone", "find a user", "look up", "find anything"] },
  { group: "Everyone", href: "/courses", label: "Browse training programs", who: ANY, what: "Every published program from AAICBI and its training organizations, with details before you enrol.", aliases: ["courses", "programs", "training", "classes", "learn", "catalogue", "catalog"] },
  { group: "Everyone", href: "/courses/upcoming", label: "Upcoming programs", who: ANY, what: "Programs that are coming soon, with their dates.", aliases: ["coming soon", "upcoming courses", "new programs"] },
  { group: "Everyone", href: "/organizations", label: "Training organizations", who: ANY, what: "The organizations that run programs, with their public pages, courses and events.", aliases: ["organizations", "organisations", "academies", "institutes", "providers", "schools"] },
  { group: "Everyone", href: "/trainees", label: "Trainees", who: ANY, what: "Members who have public profiles, with their skills.", aliases: ["people", "members", "talent", "students", "learners", "directory"] },
  { group: "Everyone", href: "/startups", label: "Startups", who: ANY, what: "Approved startups: what they build, their stage and what they are looking for.", aliases: ["startup directory", "founders", "ventures", "companies"] },
  { group: "Everyone", href: "/jobs", label: "Jobs and opportunities", who: ANY, what: "Open roles from approved employers. Reading is open; applying needs an account.", aliases: ["jobs", "opportunities", "vacancies", "careers", "work", "hiring"] },
  { group: "Everyone", href: "/events", label: "Events", who: ANY, what: "Upcoming events announced by training organizations.", aliases: ["upcoming events", "workshops", "meetups", "webinars"] },
  { group: "Everyone", href: "/learn", label: "Educational videos", who: ANY, what: "Short videos presented by trainees about real projects and what they learned.", aliases: ["videos", "watch", "education videos", "learn from trainees"] },
  { group: "Everyone", href: "/showcase", label: "Community showcase", who: ANY, what: "Projects trainees chose to show, after review.", aliases: ["showcase", "projects", "portfolio", "demo"] },
  { group: "Everyone", href: "/certificate", label: "Verify a certificate", who: ANY, what: "Check that a certificate is genuine using its code.", aliases: ["verify certificate", "check certificate", "certificate code", "is this certificate real"] },
  { group: "Everyone", href: "/privacy-policy", label: "Privacy policy", who: ANY, what: "What data the platform keeps and how it is used.", aliases: ["privacy", "data", "terms", "gdpr", "cookies"] },
  { group: "Everyone", href: "/app", label: "Get the app", who: ANY, what: "How to install AAICBI on a phone or computer.", aliases: ["install", "install app", "download app", "add to home screen", "phone app"] },
  { group: "Everyone", href: "/exam/enter", label: "Enter an exam code", who: ANY, what: "Start an examination you were given a code for.", aliases: ["exam code", "enter exam code"] },

  // ---- Join and sign in
  { group: "Join and sign in", href: "/join", label: "Create an account", who: ANY, what: "Compare the five kinds of account (member, training organization, employer, investor, startup founder) and pick yours.", aliases: ["sign up", "signup", "register", "join", "get started", "new account", "create account"] },
  { group: "Join and sign in", href: "/login", label: "Log in", who: ANY, what: "One place to start signing in; it sends you to the right sign-in for your kind of account.", aliases: ["login", "log in", "sign in", "signin"] },
  { group: "Join and sign in", href: "/trainee/register", label: "Create a member (trainee) account", who: ANY, what: "Free sign-up for learners; confirm your email to finish.", aliases: ["register as a trainee", "student account", "learner account"] },
  { group: "Join and sign in", href: "/trainee/login", label: "Member (trainee) sign in", who: ANY, what: "Sign in as a member or startup founder.", aliases: ["trainee login", "student login", "member login"] },
  { group: "Join and sign in", href: "/trainee/forgot-password", label: "Forgot my password (member)", who: ANY, what: "Get an email link to choose a new password.", aliases: ["forgot password", "reset password", "lost password"] },
  { group: "Join and sign in", href: "/startup/register", label: "Create a startup (founder) account", who: ANY, what: "Sign up as a founder; your startup profile is created as a draft for review.", aliases: ["register a startup", "founder account", "start a startup"] },
  { group: "Join and sign in", href: "/org/register", label: "Register your organization", who: ANY, what: "Apply to run programs on AAICBI; new organizations are reviewed first.", aliases: ["become a training organization", "register organization", "register my organisation"] },
  { group: "Join and sign in", href: "/org/login", label: "Organization sign in", who: ANY, what: "Sign in as an organization owner or team member.", aliases: ["organization login", "organisation login", "team login"] },
  { group: "Join and sign in", href: "/employer/register", label: "Register as an employer", who: ANY, what: "Apply to find talent and post jobs; reviewed before you go live.", aliases: ["employer sign up", "hire", "recruit"] },
  { group: "Join and sign in", href: "/employer/login", label: "Employer sign in", who: ANY, what: "Sign in as an employer.", aliases: ["employer login"] },
  { group: "Join and sign in", href: "/investor/register", label: "Register as an investor", who: ANY, what: "Apply to see startups and pitches; reviewed before you go live.", aliases: ["investor sign up", "invest"] },
  { group: "Join and sign in", href: "/investor/login", label: "Investor sign in", who: ANY, what: "Sign in as an investor.", aliases: ["investor login"] },

  // ---- Any signed-in account
  { group: "Everyone", href: "/compose", label: "Write a post", who: IN, what: "Share something you learned or built: text, up to a few pictures, or a YouTube link. Clean posts publish at once; anything unusual is checked by the team first.", aliases: ["post", "new post", "create a post", "share", "write", "publish a post"] },
  { group: "Everyone", href: "/my-posts", label: "My posts", who: IN, what: "Your posts and their status: published, waiting for a second look, or needing changes. Edit, withdraw or delete here.", aliases: ["my posts", "my drafts", "post status", "my publications"] },
  { group: "Everyone", href: "/saved", label: "Saved posts", who: IN, what: "Posts you bookmarked to read again.", aliases: ["bookmarks", "saved", "favourites", "favorites"] },
  { group: "Everyone", href: "/notifications", label: "Notifications", who: IN, what: "Alerts about your account: replies, decisions, messages and updates.", aliases: ["alerts", "bell", "updates", "notification"] },

  // ---- Member (trainee)
  { group: "Member (trainee)", href: "/trainee/dashboard", label: "My dashboard", who: ["trainee"], what: "Your home: what to do next, your courses, alerts and messages.", aliases: ["dashboard", "home", "my home"] },
  { group: "Member (trainee)", href: "/trainee/courses", label: "My courses", who: ["trainee"], what: "Programs you are enrolled in; open one to study its lessons.", aliases: ["courses", "my programs", "lessons", "study", "continue learning"] },
  { group: "Member (trainee)", href: "/trainee/examinations", label: "Examinations and results", who: ["trainee"], what: "Your assessments and course examinations, and your results with feedback.", aliases: ["exams", "assessments", "results", "grades", "tests"] },
  { group: "Member (trainee)", href: "/trainee/assignments", label: "Assignments", who: ["trainee"], what: "Written work set by your instructors, with feedback after you submit.", aliases: ["homework", "assignment feedback"] },
  { group: "Member (trainee)", href: "/trainee/certificates", label: "My certificates", who: ["trainee"], what: "Certificates you earned, to download and share with a verification link.", aliases: ["certificate", "download certificate", "share certificate"] },
  { group: "Member (trainee)", href: "/trainee/progress", label: "My progress", who: ["trainee"], what: "How far you are in each program.", aliases: ["progress", "how am i doing"] },
  { group: "Member (trainee)", href: "/trainee/my-activity", label: "Analytics and reports", who: ["trainee"], what: "Your learning activity over time.", aliases: ["analytics", "reports", "my activity", "stats"] },
  { group: "Member (trainee)", href: "/trainee/arena", label: "Ayakbi Arena", who: ["trainee"], what: "Challenge an online coursemate to Ayakbi Arena, a two-player question game, when it is switched on for your course.", aliases: ["game", "arena", "play a game", "challenge a friend", "the interview"] },
  { group: "Member (trainee)", href: "/trainee/messages", label: "Messages", who: ["trainee"], what: "Conversations with instructors, organizations and employers.", aliases: ["chat", "inbox", "dm"] },
  { group: "Member (trainee)", href: "/trainee/explore", label: "Explore", who: ["trainee"], what: "Organizations, jobs and events in one place.", aliases: ["explore", "discover"] },
  { group: "Member (trainee)", href: "/trainee/profile", label: "My profile", who: ["trainee"], what: "Your name, photo, skills, education, experience and projects; choose who can see your profile (public by default, or narrower).", aliases: ["profile", "edit profile", "profile visibility", "make my profile private", "privacy", "who can see my profile", "avatar", "profile picture"] },
  { group: "Member (trainee)", href: "/trainee/settings", label: "Settings", who: ["trainee"], what: "Password, notifications and your account preferences.", aliases: ["account settings", "password", "preferences", "notification settings"] },
  { group: "Member (trainee)", href: "/trainee/downloads", label: "My downloads", who: ["trainee"], what: "Materials you saved for offline study.", aliases: ["downloads", "offline"] },
  { group: "Member (trainee)", href: "/trainee/buddy", label: "Ask Loop (Learning Buddy)", who: ["trainee"], what: "Study help from an AI buddy that explains ideas without giving exam answers.", aliases: ["learning buddy", "study buddy", "ai help", "ask for help"] },
  { group: "Member (trainee)", href: "/trainee/introductions", label: "Introductions", who: ["trainee"], what: "Requests from employers who want to meet you; accept or decline.", aliases: ["employer requests", "introduction requests"] },
  { group: "Member (trainee)", href: "/trainee/job-postings", label: "Job board", who: ["trainee"], what: "Open jobs matched to the platform's employers, with apply buttons.", aliases: ["jobs", "apply for a job", "job applications"] },
  { group: "Member (trainee)", href: "/trainee/videos", label: "My videos", who: ["trainee"], what: "Education videos about your work and where each stands.", aliases: ["my videos", "my education videos"] },
  { group: "Member (trainee)", href: "/trainee/education-consent", label: "Video requests", who: ["trainee"], what: "Organizations asking to present your project in a video; approve or decline.", aliases: ["consent", "video consent"] },
  { group: "Member (trainee)", href: "/trainee/startups", label: "My startups", who: ["trainee"], what: "Startups you founded or joined: edit the profile, manage the team, submit for review.", aliases: ["startup", "my startup", "manage startup", "team"] },
  { group: "Member (trainee)", href: "/trainee/pitch", label: "My ventures (pitches)", who: ["trainee"], what: "Your pitches to investors and their status.", aliases: ["pitches", "ventures", "pitch"] },
  { group: "Member (trainee)", href: "/trainee/pitch/new", label: "Submit a pitch", who: ["trainee"], what: "Create a pitch for investors.", aliases: ["new pitch", "create a pitch"] },
  { group: "Member (trainee)", href: "/trainee/report", label: "Report a concern", who: ["trainee"], what: "Tell the team about something wrong with a profile or person.", aliases: ["report", "report a problem", "report a user"] },

  // ---- Employer
  { group: "Employer", href: "/employer/dashboard", label: "Employer dashboard", who: ["employer"], what: "Your home: applications, introductions and activity.", aliases: ["dashboard", "home"] },
  { group: "Employer", href: "/employer/discover", label: "Discover trainees", who: ["employer"], what: "Search members by skills and availability; request an introduction.", aliases: ["find talent", "candidates", "search trainees", "talent"] },
  { group: "Employer", href: "/employer/introductions", label: "My introductions", who: ["employer"], what: "Introduction requests you sent and their answers.", aliases: ["introductions", "requests"] },
  { group: "Employer", href: "/employer/job-postings", label: "Job postings", who: ["employer"], what: "Create jobs, see applications, and track review status.", aliases: ["post a job", "jobs", "vacancies", "applicants", "applications"] },
  { group: "Employer", href: "/employer/messages", label: "Messages", who: ["employer"], what: "Conversations with trainees you connected with.", aliases: ["chat", "inbox"] },
  { group: "Employer", href: "/employer/organizations", label: "Training organizations", who: ["employer"], what: "Browse the organizations that train talent.", aliases: ["organizations", "partners"] },
  { group: "Employer", href: "/employer/profile", label: "Company profile", who: ["employer"], what: "Your company name, logo and details, and who can see your profile (public by default).", aliases: ["profile", "company page", "profile visibility", "make my profile private"] },
  { group: "Employer", href: "/employer/settings", label: "Settings", who: ["employer"], what: "Password and notification preferences.", aliases: ["password", "preferences"] },
  { group: "Employer", href: "/employer/status", label: "Application status", who: ["employer"], what: "Where your employer application stands while it is under review.", aliases: ["status", "verification", "pending approval"] },

  // ---- Investor
  { group: "Investor", href: "/investor/dashboard", label: "Investment opportunities", who: ["investor"], what: "Pitches and startups you can look at.", aliases: ["pitches", "opportunities", "dashboard", "home"] },
  { group: "Investor", href: "/investor/organizations", label: "Training organizations", who: ["investor"], what: "Browse the organizations behind the talent.", aliases: ["organizations"] },
  { group: "Investor", href: "/investor/status", label: "Account status", who: ["investor"], what: "Where your investor application stands.", aliases: ["status", "verification", "account"] },

  // ---- Training organization (and AAICBI team where they share the page)
  { group: "Training organization", href: "/admin/organization", label: "Organization overview", who: ["organization"], what: "Your workspace: trainees, seat use, and the things to do next.", aliases: ["workspace", "my organization", "home", "overview"] },
  { group: "Training organization", href: "/admin/organization/profile", label: "Public profile", who: ["organization"], what: "Your public page: tagline, description, logo, cover and whether it is switched on.", aliases: ["public page", "organization page", "profile"] },
  { group: "Training organization", href: "/admin/organization/team", label: "Team", who: ["organization"], what: "Invite colleagues, give each a role (manager, editor, viewer), and see recent activity under each person's name.", aliases: ["teammates", "invite teammate", "staff", "roles", "activity", "who changed"] },
  { group: "Training organization", href: "/admin/organization/events", label: "Events", who: ["organization"], what: "Announce events on your public page.", aliases: ["post an event", "create event"] },
  { group: "Training organization", href: "/admin/organization/programs", label: "Program skills", who: ["organization"], what: "Tag your programs with the skills they teach so people can find them.", aliases: ["tag skills", "skills"] },
  { group: "Training organization", href: "/admin/organization/insights", label: "Content and visibility", who: ["organization"], what: "How your public content is being seen.", aliases: ["insights", "visibility", "how is my content doing"] },
  { group: "Training organization", href: "/admin/organization/posts", label: "Member posts", who: ["organization"], what: "Posts by your members that mention your organization; hold or release them.", aliases: ["member posts", "moderate posts", "hold a post"] },
  { group: "Training organization", href: "/org/billing", label: "Platform access (billing)", who: ["organization"], what: "Your platform-fee payment status, if your plan uses one.", aliases: ["billing", "payment", "platform fee", "subscription", "pay"] },
  { group: "Training organization", href: "/admin/dashboard", label: "Dashboard", who: ORGSTAFF, what: "The workspace home with your key numbers.", aliases: ["dashboard", "home"] },
  { group: "Training organization", href: "/admin/courses", label: "Courses", who: ORGSTAFF, what: "Create and manage programs: modules, lessons, materials, pricing, schedule, who can edit, and where payments go.", aliases: ["manage courses", "create a course", "my courses", "programs", "upload a course", "share a course", "collaborate"] },
  { group: "Training organization", href: "/admin/courses/new", label: "Create a course", who: ORGSTAFF, what: "Start a new program.", aliases: ["new course", "add a course", "upload course"] },
  { group: "Training organization", href: "/admin/exams", label: "Examinations", who: ORGSTAFF, what: "Examinations, question banks and results.", aliases: ["exams", "assessments", "question bank"] },
  { group: "Training organization", href: "/admin/exams/new", label: "Create an examination", who: ORGSTAFF, what: "Start a new examination and import questions from a Word file.", aliases: ["new exam", "add exam"] },
  { group: "Training organization", href: "/admin/assignments", label: "Assignments", who: ORGSTAFF, what: "Written assignments with AI-assisted marking you can review.", aliases: ["homework", "create assignment"] },
  { group: "Training organization", href: "/admin/assignments/new", label: "Create an assignment", who: ORGSTAFF, what: "Write or upload a new assignment.", aliases: ["new assignment"] },
  { group: "Training organization", href: "/admin/certificate-templates", label: "Certificate studio", who: ORGSTAFF, what: "Design the certificate your trainees receive, with your own logo.", aliases: ["certificate designer", "design certificates", "certificate template"] },
  { group: "Training organization", href: "/admin/education", label: "Education videos", who: ORGSTAFF, what: "Publish videos presented by your trainees.", aliases: ["videos", "trainee videos"] },
  { group: "Training organization", href: "/admin/messages", label: "Messages", who: ORGSTAFF, what: "Conversations with trainees.", aliases: ["chat", "inbox"] },
  { group: "Training organization", href: "/admin/performance", label: "Performance", who: ORGSTAFF, what: "How your trainees are doing.", aliases: ["results", "trainee progress"] },
  { group: "Training organization", href: "/admin/payments", label: "Payments", who: ORGSTAFF, what: "Payments for your programs.", aliases: ["money", "revenue", "sales"] },
  { group: "Training organization", href: "/admin/settings", label: "Settings", who: ORGSTAFF, what: "Account and security settings.", aliases: ["password", "account"] },
  { group: "Training organization", href: "/admin/profile", label: "My account profile", who: STAFF, what: "Your own name, photo and details as a team member.", aliases: ["my profile", "profile"] },

  // ---- AAICBI team
  { group: "AAICBI team", href: "/admin/game-results", label: "Game results", who: STAFF, what: "Who plays the games and how they do: every player from course games, quiz practice and the feed, with answers, accuracy by game type and their latest answers, plus a CSV download. A Super Admin always sees it and chooses, with a share switch and a switch per person, which staff may also open it (they see only players in their own courses).", aliases: ["game results", "player results", "who played the games", "game performance", "leaderboard", "how are players doing"] },
  { group: "AAICBI team", href: "/admin/arena", label: "Ayakbi Arena", who: STAFF, what: "Turn the Ayakbi Arena (two trainees challenge each other live on a course) on or off for the whole platform, one organization or one course, and set the rules of play: seconds per question, seconds to pick a number, the bonus for a stolen question, pauses and questions per match. Everything is off until you switch it on. Spectators, chat and the ladder have their own switches and arrive in later releases.", aliases: ["gaming arena", "the interview game", "challenge game", "turn on the arena", "multiplayer game", "live game", "arena settings"] },
  { group: "AAICBI team", href: "/admin/growth", label: "Growth", who: STAFF, what: "Switch on the public taster game that brings newcomers into a course: a link anyone can play with no account, then module 1 free, then payment. Platform master switch, separate switches for AAICBI courses and organization courses, each organization (with its agreement, commission and scholarship seats) and each course, where you also set how many scholarship seats it has and when they open. Everything is off until you switch it on.", aliases: ["growth funnel", "taster game", "play link", "marketing link", "enroll newcomers", "commission", "scholarship seats"] },
  { group: "AAICBI team", href: "/admin/growth/report", label: "Growth report", who: STAFF, what: "How many people went from the free taster game to a payment, and where they came from: started the taster, finished it, saved their score, started Module 1, passed it, paid. Also the commission ledger: each payment that came through a campaign for an organization's course, the organization's rate, what is owed to AAICBI, and what has been settled. A Super Admin marks commissions settled or reversed and can download the ledger as a spreadsheet; an organization sees only its own courses.", aliases: ["campaign report", "commission", "commission ledger", "taster results", "growth results", "how many enrolled from the game", "what an organization owes", "settle commission"] },
  { group: "AAICBI team", href: "/admin/growth/groups", label: "Squads and challenges", who: STAFF, what: "Every squad and friend challenge started from a public taster link: members, points, rivals and links. Rename or remove a squad with a bad name, or clear a nickname. Scores are never changed.", aliases: ["squads", "challenges", "duels", "rename squad", "remove squad", "bad nickname", "taster groups"] },
  { group: "AAICBI team", href: "/admin/analytics", label: "Analytics", who: STAFF, what: "Platform-wide activity and trends.", aliases: ["statistics", "stats"] },
  { group: "AAICBI team", href: "/admin/trainees", label: "Trainees", who: STAFF, what: "Every member account; open one for details.", aliases: ["members", "users", "find a user"] },
  { group: "AAICBI team", href: "/admin/employers", label: "Employer accounts", who: STAFF, what: "Review and manage employer applications.", aliases: ["employers", "approve employer"] },
  { group: "AAICBI team", href: "/admin/investors", label: "Investor accounts", who: STAFF, what: "Review and manage investor applications.", aliases: ["investors", "approve investor"] },
  { group: "AAICBI team", href: "/admin/training-organizations", label: "Training organizations", who: STAFF, what: "Approve organizations, set billing and payout accounts.", aliases: ["approve organization", "organizations"] },
  { group: "AAICBI team", href: "/admin/instructors", label: "Instructors", who: STAFF, what: "Instructor accounts and course assignments.", aliases: ["teachers", "assign instructor"] },
  { group: "AAICBI team", href: "/admin/staff", label: "Staff accounts", who: STAFF, what: "Team members and who may review posts.", aliases: ["team", "reviewers", "invite staff"] },
  { group: "AAICBI team", href: "/admin/review", label: "Review inbox", who: STAFF, what: "Posts and questions waiting for a person, with the reasons they were held.", aliases: ["review posts", "moderation", "approve posts", "reports queue"] },
  { group: "AAICBI team", href: "/admin/reports", label: "Reported profiles", who: STAFF, what: "Reports about profiles and what was decided.", aliases: ["reports", "reported users"] },
  { group: "AAICBI team", href: "/admin/handle-requests", label: "Handle requests", who: STAFF, what: "Members asking to change their @handle.", aliases: ["change handle", "username requests"] },
  { group: "AAICBI team", href: "/admin/startups", label: "Startups", who: STAFF, what: "Approve, reject, suspend or verify startups.", aliases: ["approve startup", "verify startup"] },
  { group: "AAICBI team", href: "/admin/showcase", label: "Showcase review", who: STAFF, what: "Projects waiting to enter the community showcase.", aliases: ["approve showcase", "projects"] },
  { group: "AAICBI team", href: "/admin/job-postings", label: "Job posting review", who: STAFF, what: "Jobs waiting for approval.", aliases: ["approve jobs", "jobs review"] },
  { group: "AAICBI team", href: "/admin/pitches", label: "Pitch review center", who: STAFF, what: "Pitches to score and decide.", aliases: ["pitches", "review pitches"] },
  { group: "AAICBI team", href: "/admin/pitch-cohorts", label: "Pitch cohorts", who: STAFF, what: "Groups of pitches reviewed together.", aliases: ["cohorts"] },
  { group: "AAICBI team", href: "/admin/testimonials", label: "Testimonials", who: STAFF, what: "Testimonials shown on the platform.", aliases: ["reviews"] },
  { group: "AAICBI team", href: "/admin/inbox", label: "Inbox", who: STAFF, what: "Messages to the team.", aliases: ["messages to staff"] },
  { group: "AAICBI team", href: "/admin/agreement-templates", label: "Agreement templates", who: STAFF, what: "Instructor agreement wording.", aliases: ["agreements", "contracts"] },
  { group: "AAICBI team", href: "/admin/ecosystem", label: "Public ecosystem switches", who: STAFF, what: "Turn public parts of the platform on or off.", aliases: ["switches", "feature flags", "turn off feed"] },
  { group: "Training organization", href: "/admin/studio", label: "Game Studio", who: ORGSTAFF, what: "Build learning games on one page: import a reviewed content file for a module (quiz, matching, ordering and scenario items) after seeing what would be saved, tidy the module's objectives, approve what you want to go live, preview the games as trainees will play them, and assign them to your modules. Questions are kept in two apart sides (games and practice, and the assessment) and nothing is written by AI in the studio. You see only your own courses and games, and what you can do here (use Loop, write items, assign games, question pools) depends on what a Super Admin has allowed for you; a Super Admin sees everything.", aliases: ["game studio", "games", "practice and mastery", "create a game", "assign a game", "why can't I assign a game", "loop in the studio"] },
  { group: "Training organization", href: "/admin/studio/demo", label: "Game demo", who: ORGSTAFF, what: "Play a sample 10-question round in each game format (quiz, matching, ordering, scenario) to see the animated trainee experience with Loop, the countdown, sounds and the round summary. Nothing is saved and no XP is paid.", aliases: ["game demo", "sample games", "try the games", "see how games look", "preview the game experience"] },
  { group: "AAICBI team", href: "/admin/requests", label: "Change requests", who: STAFF, what: "Super Admin only. Write down a change you want made to the platform, approve or decline each one, and hand the approved ones to Claude Code, which makes the change in a pull request that a person reviews.", aliases: ["change request", "request a change", "ask for a change", "feature request", "suggest a change"] },
  { group: "AAICBI team", href: "/admin/command", label: "Command Center", who: STAFF, what: "Platform health, monitoring and the consultant's suggestions.", aliases: ["command center", "monitoring", "consultant", "platform report"] },
  { group: "AAICBI team", href: "/admin/command/guide", label: "Loop knowledge", who: STAFF, what: "Loop's written answers, unanswered questions and settings.", aliases: ["guide bot", "loop settings", "train loop", "faq"] },
  { group: "AAICBI team", href: "/admin/platform-settings", label: "Platform settings", who: STAFF, what: "Session lengths, security and platform-wide options.", aliases: ["settings", "security settings"] },
  { group: "AAICBI team", href: "/admin/translations", label: "Translations", who: STAFF, what: "Language text used across the platform.", aliases: ["languages", "i18n"] },
  { group: "AAICBI team", href: "/admin/design-system", label: "Design system", who: STAFF, what: "The platform's colours, components and brand.", aliases: ["brand", "components"] },

  // ---- Instructor
  { group: "Instructor", href: "/instructor/dashboard", label: "Instructor dashboard", who: STAFF, what: "Your home as an instructor.", aliases: ["dashboard", "home"] },
  { group: "Instructor", href: "/instructor/courses", label: "My courses (instructor)", who: STAFF, what: "Courses you teach, with performance.", aliases: ["courses", "teach"] },
  { group: "Instructor", href: "/instructor/materials", label: "Teaching materials", who: STAFF, what: "Materials you uploaded to your courses.", aliases: ["materials", "uploads"] },
  { group: "Instructor", href: "/instructor/payments", label: "My payments", who: STAFF, what: "Your payout arrangement and earnings.", aliases: ["payout", "earnings"] },
  { group: "Instructor", href: "/instructor/agreement", label: "Instructor agreement", who: STAFF, what: "Your teaching agreement to read and sign.", aliases: ["agreement", "contract"] },
];

/**
 * Pages that exist only for one item (a course, a post, a profile ...). Loop sends people to the list or the page they
 * come from and says how to open the item, instead of offering a button to an address that needs an id.
 */
export interface DynamicPage {
  route: string;
  what: string;
  /** Where it opens from. */
  from: string;
  how: string;
}

export const DYNAMIC: DynamicPage[] = [
  { route: "/trainee/arena/[courseId]", what: "A course's arena: who is online, challenges and recent matches.", from: "/trainee/arena", how: "Pick a course on the Ayakbi Arena page." },
  { route: "/trainee/arena/[courseId]/chat", what: "The course chat: talk with coursemates, accept or decline Ayakbi Arena challenges and answer Fastest Fingers questions.", from: "/trainee/courses", how: "Open a course, then the Course chat card on a course page, or tap a chat notification." },
  { route: "/trainee/arena/[courseId]/ladder", what: "The course's champion ladder: top players, tiers, the weekly champion and your own place.", from: "/trainee/arena", how: "Open a course in Ayakbi Arena, then tap your tier at the top or the Ladder link." },
  { route: "/trainee/arena/watch/[id]", what: "Watching a live match: the score, the clock and the question, with emoji cheers.", from: "/trainee/arena", how: "Open a course in Ayakbi Arena and tap Watch on a match under Live now." },
  { route: "/trainee/arena/[courseId]/event/[eventId]", what: "A live event: the knockout bracket, the matches being played, your place and a Join button.", from: "/trainee/arena", how: "Open a course in Ayakbi Arena and tap Join the event when your instructor opens one." },
  { route: "/trainee/arena/match/[id]", what: "A live match of Ayakbi Arena, full screen and landscape.", from: "/trainee/arena", how: "Open a course, then challenge a coursemate or accept a challenge." },
  { route: "/post/[id]", what: "One post with all its comments.", from: "/feed", how: "Open a post from the feed." },
  { route: "/tags/[tag]", what: "Posts that use one #topic.", from: "/feed", how: "Tap a #topic on a post or in Topics this week." },
  { route: "/courses/[id]", what: "A program's page with its outline, requirements and enrol button.", from: "/courses", how: "Open a program from the list." },
  { route: "/organizations/[slug]", what: "An organization's public page: courses, events, videos.", from: "/organizations", how: "Open an organization from the list." },
  { route: "/jobs/[id]", what: "One job with its description and apply button.", from: "/jobs", how: "Open a job from the list." },
  { route: "/play/[id]", what: "A short game from a course. A course link shared on WhatsApp opens a 5-question taster with no account, ending in a rank and a way to challenge friends (they play the same five questions and you compare scores), share a result card, save your score or start Module 1 free. A challenge link opens on a message saying who challenged you. A group can start a squad (its members all play the same questions and the scores add up), and a squad can challenge another squad. A game opened from the feed is a ten-question round and needs signing in; when it goes badly Loop invites you to register for the course.", from: "/", how: "Tap a game under Try a game on the feed." },
  { route: "/play/[id]/continue", what: "Where someone goes after the taster to open Module 1 free. A signed-in trainee is taken straight into the course; anyone else is offered a free account or sign-in and returns here.", from: "/", how: "Tap Start Module 1, free on your taster result, after playing a course link." },
  { route: "/growth/optout/[token]", what: "The private link in a message from AAICBI about a course. One tap stops all messages.", from: "/", how: "Open the stop link in the message you received." },
  { route: "/learn/[id]", what: "One education video.", from: "/learn", how: "Open a video from the list." },
  { route: "/showcase/[id]", what: "One showcase project.", from: "/showcase", how: "Open a project from the showcase." },
  { route: "/certificate/[code]", what: "The result of verifying one certificate.", from: "/certificate", how: "Enter the certificate code." },
  { route: "/profile/[code]", what: "A shared certificate-backed profile.", from: "/trainee/certificates", how: "Share the link from your certificates." },
  { route: "/profile/u/[username]", what: "A person's earlier profile address; it opens their @handle page.", from: "/search", how: "Search for the person." },
  { route: "/p/[handle]", what: "A person's, organization's or startup's page (written /@handle in the address bar).", from: "/search", how: "Search for the name, or tap their name on a post." },
  { route: "/collaborate/[token]", what: "An invitation link to edit a course, examination or assignment together, or to take a copy of a course.", from: "/admin/courses", how: "Someone sends you the link; sign in as staff, instructor or organization, then open it." },
  { route: "/certificate-templates/review/[token]", what: "A certificate design sent to an organization for approval.", from: "/admin/certificate-templates", how: "Open the review link you were sent." },
  { route: "/exam/[code]", what: "An examination you were given a code for (instructions, the exam itself, and the result).", from: "/exam/enter", how: "Enter the code you were given." },
  { route: "/trainee/courses/[id]", what: "One of your enrolled courses: lessons, modules, assessments, the course examination, unlock code, payment.", from: "/trainee/courses", how: "Open a course from My courses." },
  { route: "/trainee/assignments/[id]", what: "One assignment and your result.", from: "/trainee/assignments", how: "Open an assignment from the list." },
  { route: "/trainee/lessons/[id]/qa", what: "Questions and answers about one lesson.", from: "/trainee/courses", how: "Open a lesson, then its Q and A." },
  { route: "/trainee/messages/[id]", what: "One conversation.", from: "/trainee/messages", how: "Open a conversation from Messages." },
  { route: "/trainee/pitch/[id]", what: "One pitch, with editing.", from: "/trainee/pitch", how: "Open a pitch from My ventures." },
  { route: "/trainee/startups/[id]", what: "One of your startups: details, team and review status.", from: "/trainee/startups", how: "Open a startup from My startups." },
  { route: "/employer/messages/[id]", what: "One conversation.", from: "/employer/messages", how: "Open a conversation from Messages." },
  { route: "/employer/job-postings/[id]/applications", what: "Applications for one job.", from: "/employer/job-postings", how: "Open Applications on a job." },
  { route: "/investor/pitches/[id]", what: "One pitch.", from: "/investor/dashboard", how: "Open a pitch from Investment opportunities." },
  { route: "/instructor/courses/[id]", what: "One course you teach, with its performance.", from: "/instructor/courses", how: "Open a course from My courses." },
  { route: "/instructor/materials/[id]", what: "One teaching material.", from: "/instructor/materials", how: "Open a material from the list." },
  { route: "/admin/courses/[id]", what: "Edit one course: modules, lessons, pricing, schedule, sharing, certificates, cohorts, enrolments, early warnings, Q and A, examination.", from: "/admin/courses", how: "Open a course from Courses." },
  { route: "/admin/assignments/[id]", what: "One assignment: its questions, publishing, and who can edit it together.", from: "/admin/assignments", how: "Open an assignment from the list." },
  { route: "/admin/assignments/[id]/submissions", what: "The submissions for one assignment.", from: "/admin/assignments", how: "Open an assignment, then Submissions." },
  { route: "/admin/assignments/[id]/submissions/[submissionId]", what: "One submission, with the AI-assisted marking for you to review.", from: "/admin/assignments", how: "Open Submissions, then one submission." },
  { route: "/admin/assignments/[id]/analytics", what: "How trainees did on one assignment.", from: "/admin/assignments", how: "Open an assignment, then Analytics." },
  { route: "/admin/courses/[id]/arena-event/[eventId]", what: "The big screen for a live Ayakbi Arena event: the bracket and the match being played, for a projector.", from: "/admin/courses", how: "Open a course, find Live events in the arena settings, then Open the big screen." },
  { route: "/admin/courses/[id]/certificates", what: "Certificates issued for one course.", from: "/admin/courses", how: "Open a course, then Certificates." },
  { route: "/admin/courses/[id]/cohorts", what: "The cohorts of one course.", from: "/admin/courses", how: "Open a course, then Cohorts." },
  { route: "/admin/courses/[id]/early-warnings", what: "Trainees falling behind in one course.", from: "/admin/courses", how: "Open a course, then Early warnings." },
  { route: "/admin/courses/[id]/enrollments", what: "Who is enrolled in one course, and grants of access.", from: "/admin/courses", how: "Open a course, then Enrolments." },
  { route: "/admin/courses/[id]/examination", what: "The examination that closes one course.", from: "/admin/courses", how: "Open a course, then Examination." },
  { route: "/admin/courses/[id]/performance", what: "How trainees are doing in one course.", from: "/admin/courses", how: "Open a course, then Performance." },
  { route: "/admin/courses/[id]/preview", what: "The course as a trainee will see it.", from: "/admin/courses", how: "Open a course, then Preview." },
  { route: "/admin/courses/[id]/qa", what: "Trainees' questions about the lessons of one course.", from: "/admin/courses", how: "Open a course, then Q and A." },
  { route: "/admin/courses/[id]/qa/[threadId]", what: "One lesson question and its answers.", from: "/admin/courses", how: "Open Q and A, then a question." },
  { route: "/admin/modules/[id]/assessment", what: "The assessment at the end of one module.", from: "/admin/courses", how: "Open a course, then the module's assessment." },
  { route: "/admin/modules/[id]/question-bank", what: "The question bank behind one module's assessment.", from: "/admin/courses", how: "Open a course, then the module's question bank." },
  { route: "/admin/modules/[id]/quest", what: "Practice and mastery for one module: split questions into practice and formal pools, mark required objectives and choose rewards.", from: "/admin/courses", how: "Open a course, then the module's assessment, then Practice and mastery." },
  { route: "/admin/exams/[id]/import", what: "One examination: import questions from a Word file, review them, publish, share, and manage access.", from: "/admin/exams", how: "Open an examination from the list." },
  { route: "/admin/exams/[id]/results", what: "Attempts and results for one examination.", from: "/admin/exams", how: "Open an examination, then Results." },
  { route: "/exam/[code]/instructions", what: "The rules and timing before an examination starts.", from: "/exam/enter", how: "Enter your exam code." },
  { route: "/exam/[code]/take", what: "The examination itself, with a timer.", from: "/exam/enter", how: "Start the exam after the instructions." },
  { route: "/exam/[code]/result", what: "Your result for one examination.", from: "/exam/enter", how: "You arrive here when you finish." },
  { route: "/trainee/assignments/[id]/result", what: "Your result and feedback for one assignment.", from: "/trainee/assignments", how: "Open an assignment you submitted." },
  { route: "/trainee/courses/[id]/examination", what: "The course examination: start it once you are ready.", from: "/trainee/courses", how: "Open a course, then Examination." },
  { route: "/trainee/courses/[id]/examination/take", what: "The course examination itself, with a timer.", from: "/trainee/courses", how: "Start the examination." },
  { route: "/trainee/courses/[id]/examination/result", what: "Your course examination result.", from: "/trainee/courses", how: "You arrive here when you finish." },
  { route: "/trainee/courses/[id]/modules/[moduleId]/assessment", what: "A module assessment: start it when you finish the module.", from: "/trainee/courses", how: "Finish a module's lessons, then open its assessment." },
  { route: "/trainee/courses/[id]/modules/[moduleId]/assessment/take", what: "The module assessment itself.", from: "/trainee/courses", how: "Start the assessment." },
  { route: "/trainee/courses/[id]/modules/[moduleId]/assessment/result", what: "Your module assessment result and feedback.", from: "/trainee/courses", how: "You arrive here when you finish." },
  { route: "/trainee/courses/[id]/modules/[moduleId]/games/[gameId]", what: "Play one of a module's games: matching cards, put in order, or scenario choices. XP here never counts toward your certificate.", from: "/trainee/courses", how: "Open a module in your course and choose a game from its Games strip (when your instructor has made it live)." },
  { route: "/trainee/courses/[id]/modules/[moduleId]/practice", what: "Practice a module with no timer: questions by objective, hints, XP, streaks and mastery. Practice never counts toward your certificate.", from: "/trainee/courses", how: "Open a module in your course and choose Practice (when your instructor has switched it on)." },
  { route: "/trainee/courses/[id]/payment-callback", what: "Confirms a course payment.", from: "/trainee/courses", how: "You arrive here after paying." },
  { route: "/trainee/courses/[id]/unlock", what: "Enter a code to unlock a course you were given access to.", from: "/trainee/courses", how: "Open the course, then Unlock." },
  { route: "/trainee/lessons/[id]/qa/[threadId]", what: "One lesson question and its answers.", from: "/trainee/courses", how: "Open a lesson's Q and A, then a question." },
  { route: "/trainee/pitch/[id]/edit", what: "Edit one pitch.", from: "/trainee/pitch", how: "Open a pitch, then Edit." },
  { route: "/admin/cohorts/[id]", what: "One cohort of trainees.", from: "/admin/courses", how: "Open a course, then Cohorts." },
  { route: "/admin/messages/[id]", what: "One conversation.", from: "/admin/messages", how: "Open a conversation from Messages." },
  { route: "/admin/trainees/[id]", what: "One member's account.", from: "/admin/trainees", how: "Open a member from the list." },
  { route: "/admin/instructors/[id]", what: "One instructor's account.", from: "/admin/instructors", how: "Open an instructor from the list." },
  { route: "/admin/pitches/[id]", what: "One pitch under review.", from: "/admin/pitches", how: "Open a pitch from the review center." },
  { route: "/admin/training-organizations/[id]/certificate-templates", what: "Certificate templates for one organization.", from: "/admin/training-organizations", how: "Open an organization, then Certificate templates." },
];

/** Pages that exist but are not places to go (opened from an email, or reached automatically). */
export const NOT_LISTED: Array<{ route: string; why: string }> = [
  { route: "/org/billing/payment-callback", why: "Reached automatically after paying; not a place to go." },
  { route: "/trainee/verify", why: "Opened from the confirmation email." },
  { route: "/trainee/reset-password", why: "Opened from the password email." },
  { route: "/investor/reset-password", why: "Opened from the password email." },
  { route: "/org/set-password", why: "Opened from a teammate invitation email." },
];
