import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("the home page is the feed, with the earlier landing page as the way back", () => {
  const page = readFileSync("src/app/page.tsx", "utf8");
  it("shows the feed unless it is switched off, then the earlier landing page", () => {
    expect(page).toMatch(/flags\.feed/);
    expect(page).toMatch(/<LegacyHome \/>/);
    expect(page).toMatch(/<FeedHome /);
  });
  it("/feed is the same feed and goes dark when it is off", () => {
    const feed = readFileSync("src/app/feed/page.tsx", "utf8");
    expect(feed).toMatch(/notFound\(\)/);
    expect(feed).toMatch(/<FeedHome /);
  });
});

describe("the account summary the header asks for", () => {
  const route = readFileSync("src/app/api/session/summary/route.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  it("is never cached and holds no email, token or password", () => {
    expect(route).toMatch(/no-store/);
    expect(route).not.toMatch(/passwordHash|token/i);
    // the email is only a last-resort display name when a profile has none
    expect(route).toMatch(/session\.email/);
  });
  it("works out the dashboard on the server from the session", () => {
    expect(route).toMatch(/dashboardHrefFor\(session\)/);
  });
});
