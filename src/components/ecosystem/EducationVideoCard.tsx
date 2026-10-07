import Link from "next/link";
import { Play } from "lucide-react";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import VerifiedBadge from "./VerifiedBadge";

export interface EducationVideoCardData {
  id: string;
  title: string;
  thumbnailUrl: string;
  category: string | null;
  viewCount: number;
  likeCount: number;
  skills: string[];
  traineeName: string;
  programLabel: string | null;
  organizationName: string;
  organizationSlug: string | null;
  organizationVerified: boolean;
}

/**
 * The trainee educational video card. Attribution is explicit: the
 * trainee is the presenter, the organization is the publisher, and the
 * organization name is always visible and links to its page.
 */
export default function EducationVideoCard({ post, hideOrganizationLink = false }: { post: EducationVideoCardData; hideOrganizationLink?: boolean }) {
  return (
    <Card className="flex h-full flex-col overflow-hidden !p-0">
      <Link href={`/learn/${post.id}`} className="group relative block aspect-video bg-brand-sand" aria-label={`Watch ${post.title}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a YouTube thumbnail URL derived from the validated video id. */}
        <img src={post.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/25">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white">
            <Icon icon={Play} size="md" />
          </span>
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <p className="text-sm font-semibold text-brand-ink">{post.traineeName}</p>
          <p className="text-xs text-gray-600">{post.programLabel ? `${post.programLabel} Trainee` : "Trainee"}</p>
        </div>
        <div>
          {post.organizationSlug && !hideOrganizationLink ? (
            <Link href={`/organizations/${post.organizationSlug}`} className="text-sm font-semibold text-brand-teal hover:underline">
              {post.organizationName}
            </Link>
          ) : (
            <p className="text-sm font-semibold text-brand-ink">{post.organizationName}</p>
          )}
          {post.organizationVerified && (
            <div>
              <VerifiedBadge />
            </div>
          )}
        </div>
        <Link href={`/learn/${post.id}`} className="font-display font-semibold text-brand-ink hover:text-brand-teal">
          {post.title}
        </Link>
        {(post.category || post.skills.length > 0) && (
          <p className="text-xs text-gray-600">{[post.category, ...post.skills.slice(0, 3)].filter(Boolean).join(" • ")}</p>
        )}
        <p className="mt-auto pt-2 text-xs text-gray-500">{post.viewCount.toLocaleString("en")} views{post.likeCount > 0 ? ` • ${post.likeCount.toLocaleString("en")} likes` : ""}</p>
      </div>
    </Card>
  );
}
