import Link from "next/link";
import { Briefcase, FolderKanban, GraduationCap, Building2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import EducationVideoCard from "./EducationVideoCard";
import VerifiedBadge from "./VerifiedBadge";
import type { FeedItem } from "@/lib/ecosystem/feed";

const LABEL = {
  learn: { text: "Learn", icon: GraduationCap },
  organization: { text: "Organization", icon: Building2 },
  job: { text: "Job", icon: Briefcase },
  project: { text: "Project", icon: FolderKanban },
} as const;

function TypeLabel({ type }: { type: FeedItem["type"] }) {
  const { text, icon } = LABEL[type];
  return (
    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600">
      <Icon icon={icon} size="sm" /> {text}
    </p>
  );
}

export default function FeedCard({ item }: { item: FeedItem }) {
  switch (item.type) {
    case "learn":
      return (<div><TypeLabel type="learn" /><EducationVideoCard post={item.video} /></div>);
    case "organization":
      return (
        <div>
          <TypeLabel type="organization" />
          <Card>
            <div className="flex items-center gap-3">
              {item.org.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- an uploaded organization logo.
                <img src={item.org.logoUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-mint font-semibold text-brand-teal">{item.org.name.slice(0, 1)}</span>
              )}
              <div>
                <Link href={`/organizations/${item.org.slug}`} className="font-display font-semibold text-brand-ink hover:text-brand-teal">{item.org.name}</Link>
                {item.org.verified && <div><VerifiedBadge /></div>}
              </div>
            </div>
            {item.org.tagline && <p className="mt-3 text-sm text-gray-700">{item.org.tagline}</p>}
            {item.org.location && <p className="mt-1 text-xs text-gray-500">{item.org.location}</p>}
            <div className="mt-3"><Button href={`/organizations/${item.org.slug}`} size="sm" variant="secondary">View organization</Button></div>
          </Card>
        </div>
      );
    case "job":
      return (
        <div>
          <TypeLabel type="job" />
          <Card>
            <p className="font-display font-semibold text-brand-ink">{item.job.title}</p>
            <p className="text-sm text-gray-600">{item.job.company}</p>
            <p className="mt-1 text-xs text-gray-500">Closes {item.job.closingDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
            <div className="mt-3"><Button href="/trainee/job-postings" size="sm" variant="secondary">View jobs</Button></div>
          </Card>
        </div>
      );
    case "project":
      return (
        <div>
          <TypeLabel type="project" />
          <Card interactive className="overflow-hidden">
            <Link href={`/showcase/${item.project.id}`} className="block">
              {item.project.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- an uploaded project image.
                <img src={item.project.coverUrl} alt="" className="-m-5 mb-3 h-40 w-[calc(100%+2.5rem)] max-w-none object-cover" />
              )}
              <p className="font-display font-semibold text-brand-ink">{item.project.title}</p>
              {item.project.description && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{item.project.description}</p>}
              <p className="mt-2 text-xs font-semibold text-gray-600">by {item.project.founderName}</p>
            </Link>
          </Card>
        </div>
      );
  }
}
