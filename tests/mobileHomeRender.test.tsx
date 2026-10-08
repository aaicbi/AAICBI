import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import MobileHome from "@/components/mobile/MobileHome";
import type { MobileBlock } from "@/lib/mobile/homeCore";

const blocks: MobileBlock[] = [
  { kind: "actions", items: [{ label: "Explore", href: "/trainee/explore" }] },
  { kind: "course", title: "SQL for Analysts", percent: 40, detail: "2 of 5 modules complete", href: "/trainee/courses/c1" },
  { kind: "alerts", unread: 3, items: [{ title: "Open day tomorrow", href: "/events" }] },
  { kind: "welcome", greeting: "Good morning", name: "Ada", line: "1 course in progress" },
  { kind: "messages", href: "/trainee/messages" },
];

describe("MobileHome markup", () => {
  const html = renderToStaticMarkup(<MobileHome role="trainee" blocks={blocks} />);
  it("renders the cards in priority order whatever order they were built in", () => {
    const at = (s: string) => html.indexOf(s);
    expect(at("Good morning")).toBeLessThan(at("Alerts (3 new)"));
    expect(at("Alerts (3 new)")).toBeLessThan(at("Continue learning"));
    expect(at("Continue learning")).toBeLessThan(at("Messages"));
    expect(at("Messages")).toBeLessThan(at("Quick actions"));
  });
  it("gives the course a progress bar and a Resume button that goes to the exact lesson", () => {
    expect(html).toMatch(/role="progressbar"[^>]*aria-valuenow="40"/);
    expect(html).toMatch(/href="\/trainee\/courses\/c1"[^>]*>Resume/);
  });
  it("has exactly one main landmark and one h1", () => {
    expect(html.match(/<main/g)?.length).toBe(1);
    expect(html.match(/<h1/g)?.length).toBe(1);
  });
  it("makes every link a comfortable tap target", () => {
    const links = html.match(/<a [^>]*>/g) ?? [];
    expect(links.length).toBeGreaterThan(3);
    for (const l of links) expect(l, l).toMatch(/min-h-\[4[48]px\]/);
  });
});
