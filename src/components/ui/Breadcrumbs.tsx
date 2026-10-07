import Link from "next/link";
import { ChevronRight } from "lucide-react";
import Icon from "./Icon";

/**
 * Where you are, and the way back up, for pages more than one level
 * deep (a course's certificates, a module's assessment). The last item
 * is the current page and is not a link. BackLink stays for pages that
 * only need a single "back" action.
 */
export interface Crumb {
  label: string;
  href?: string;
}

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-gray-600">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <Link href={item.href} className="font-semibold text-brand-teal hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined} className={isLast ? "font-semibold text-brand-ink" : ""}>
                  {item.label}
                </span>
              )}
              {!isLast && <Icon icon={ChevronRight} size="sm" className="text-gray-500" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
