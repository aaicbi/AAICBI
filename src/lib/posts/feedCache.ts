import { revalidateTag } from "next/cache";

/** Call after anything that changes which posts are public, so visitors' cached feed is rebuilt at once. Outside a web request (scripts, tests) there is nothing to clear. */
export function publicFeedChanged(): void {
  try {
    revalidateTag("public-feed");
  } catch {
    // Not inside a request; the cached entry expires within a minute anyway.
  }
}

/** Call after anything that changes which startups (or other discovery panel content) are public, so the feed's side panels refresh at once. */
export function discoveryChanged(): void {
  try {
    revalidateTag("discovery");
  } catch {
    // Not inside a request; the cached panels expire within five minutes anyway.
  }
}
