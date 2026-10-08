import type { ActivityItem, LandingEvent, LandingJob, LandingOrg, LandingProgram, LandingTrainee, LandingVideo } from "@/lib/landing/types";

/**
 * Labelled example content for the landing page, used only while a
 * section has little real content (see fillWithSamples). Rules these
 * keep, enforced by tests:
 *  - every item has isSample: true and is shown with an "Example" label;
 *  - names are generic and fictional, never a real person or company;
 *  - no statistics, ratings, prices, outcomes or other claims;
 *  - every link leads to a sign-up page, never to a page that does not
 *    exist, and the call to action says what the visitor can do
 *    ("List your program"), not what the example is.
 */
export const SAMPLE_LINKS = {
  trainee: "/trainee/register",
  organization: "/org/register",
  employer: "/employer/register",
} as const;

const org = (id: string, name: string, tagline: string, location: string, skills: string[]): LandingOrg => ({
  id, name, slug: "", logoUrl: null, tagline, location, verified: false, featured: false, badges: [], skills,
  programCount: 0, videoCount: 0, href: SAMPLE_LINKS.organization, at: null, isSample: true,
});

export const SAMPLE_ORGANIZATIONS: LandingOrg[] = [
  org("sample-org-1", "Example Digital Skills Academy", "Practical training in data, software and design, with projects reviewed by instructors.", "Lagos", ["Data Analytics", "Web Development", "UI Design"]),
  org("sample-org-2", "Example Data Institute", "Short courses for people moving into data and AI work.", "Abuja", ["Python", "SQL", "Machine Learning"]),
  org("sample-org-3", "Example Creative Studio", "Hands-on media, marketing and content programs.", "Online", ["Digital Marketing", "Videography", "Content"]),
];

const program = (id: string, title: string, description: string, category: string, level: string, duration: string, format: string, orgName: string): LandingProgram => ({
  id, title, description, category, level, duration, format, priceLabel: null,
  organizationName: orgName, organizationSlug: null, href: SAMPLE_LINKS.organization, at: null, isSample: true,
});

export const SAMPLE_PROGRAMS: LandingProgram[] = [
  program("sample-prog-1", "Data Analytics Professional Program", "Learn to clean, analyse and present data with real datasets and reviewed projects.", "Data", "Beginner", "12 weeks", "Instructor-led", "Example Digital Skills Academy"),
  program("sample-prog-2", "Full-Stack Web Development", "Build and ship working web applications, from the interface to the database.", "Software", "Intermediate", "16 weeks", "Hybrid", "Example Data Institute"),
  program("sample-prog-3", "Digital Marketing Essentials", "Plan, run and measure campaigns that bring in real customers.", "Marketing", "Beginner", "8 weeks", "Self-paced", "Example Creative Studio"),
];

const job = (id: string, title: string, company: string, summary: string, skills: string[]): LandingJob => ({
  id, title, company, summary, skills, closingDate: null, href: SAMPLE_LINKS.employer, at: null, isSample: true,
});

export const SAMPLE_JOBS: LandingJob[] = [
  job("sample-job-1", "Junior Data Analyst", "Example Employer", "Support a small team with reporting and clean-up of customer data.", ["Excel", "SQL", "Data Cleaning"]),
  job("sample-job-2", "Frontend Developer Intern", "Example Employer", "Build screens for a web product with a mentor reviewing your work.", ["JavaScript", "React", "HTML"]),
  job("sample-job-3", "Customer Support Associate", "Example Employer", "Help customers by chat and email and learn the product end to end.", ["Communication", "Support"]),
];

const trainee = (id: string, name: string, location: string, skills: string[], openToWork: boolean, avatarSeed: number): LandingTrainee => ({
  id, name, username: "", avatarUrl: null, location, openToWork, skills, href: SAMPLE_LINKS.trainee, avatarSeed, isSample: true,
});

export const SAMPLE_TRAINEES: LandingTrainee[] = [
  trainee("sample-t-1", "Amara O.", "Lagos", ["Data Analytics", "Excel", "SQL"], true, 3),
  trainee("sample-t-2", "Tunde A.", "Ibadan", ["JavaScript", "React", "Git"], true, 11),
  trainee("sample-t-3", "Ngozi E.", "Enugu", ["Digital Marketing", "Content", "Analytics"], false, 22),
  trainee("sample-t-4", "Ibrahim S.", "Kano", ["Python", "Data Cleaning", "Charts"], true, 35),
];

const event = (id: string, title: string, orgName: string, where: string): LandingEvent => ({
  id, title, organizationName: orgName, locationText: where, href: SAMPLE_LINKS.organization, isSample: true,
  // Placeholders show no date: an example must not look like a real event on a real day.
  startsAt: null,
});

export const SAMPLE_EVENTS: LandingEvent[] = [
  event("sample-e-1", "Open day: meet the trainers", "Example Digital Skills Academy", "Lagos"),
  event("sample-e-2", "Demo day: trainee projects", "Example Data Institute", "Online"),
];

const activity = (id: string, kind: ActivityItem["kind"], text: string, href: string): ActivityItem => ({
  id, kind, text, href, at: null, isSample: true,
});

export const SAMPLE_ACTIVITY: ActivityItem[] = [
  activity("sample-a-1", "program", "A training organization lists a new program", SAMPLE_LINKS.organization),
  activity("sample-a-2", "video", "A trainee presents an educational video for their organization", SAMPLE_LINKS.trainee),
  activity("sample-a-3", "job", "An employer posts a role open to trainees", SAMPLE_LINKS.employer),
  activity("sample-a-4", "event", "An organization announces an open day", SAMPLE_LINKS.organization),
];

export const SAMPLE_VIDEOS: LandingVideo[] = [
  {
    isSample: true, href: SAMPLE_LINKS.trainee, at: null,
    card: { id: "sample-v-1", title: "What a data analyst does in a day", thumbnailUrl: "", category: "Data", viewCount: 0, likeCount: 0, skills: ["Data Analytics"], traineeName: "A trainee", programLabel: "Data", organizationName: "Example Digital Skills Academy", organizationSlug: null, organizationVerified: false },
  },
  {
    isSample: true, href: SAMPLE_LINKS.trainee, at: null,
    card: { id: "sample-v-2", title: "Your first web page, step by step", thumbnailUrl: "", category: "Software", viewCount: 0, likeCount: 0, skills: ["HTML"], traineeName: "A trainee", programLabel: "Software", organizationName: "Example Data Institute", organizationSlug: null, organizationVerified: false },
  },
  {
    isSample: true, href: SAMPLE_LINKS.trainee, at: null,
    card: { id: "sample-v-3", title: "Planning a small marketing campaign", thumbnailUrl: "", category: "Marketing", viewCount: 0, likeCount: 0, skills: ["Digital Marketing"], traineeName: "A trainee", programLabel: "Marketing", organizationName: "Example Creative Studio", organizationSlug: null, organizationVerified: false },
  },
];

export const ALL_SAMPLES = {
  programs: SAMPLE_PROGRAMS,
  jobs: SAMPLE_JOBS,
  organizations: SAMPLE_ORGANIZATIONS,
  trainees: SAMPLE_TRAINEES,
  events: SAMPLE_EVENTS,
  videos: SAMPLE_VIDEOS,
  activity: SAMPLE_ACTIVITY,
};
