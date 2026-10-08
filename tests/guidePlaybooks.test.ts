import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PLAYBOOKS, playbookEntries, entriesForAudience } from "@/lib/guide/playbooks";
import { answerQuestion, buildIndex } from "@/lib/guide/match";
import { DEFAULT_ENTRIES } from "@/lib/guide/defaults";

const ON = { orgPages: true, education: true, feed: true, publicJobs: true, publicTrainees: true };
const SRC = join(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|ts)$/.test(f) && !p.includes("/lib/guide/playbooks/") ) out.push(p);
  }
  return out;
}
const corpus = walk(SRC).map((f) => readFileSync(f, "utf8")).join("\n").replace(/&amp;/g, "&").replace(/&apos;/g, "'");

const labels = (t: string) => [...t.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1]);

/** Does a page exist for this href? Dynamic segments match any single segment. */
function routeExists(href: string): boolean {
  const path = href.split("#")[0].split("?")[0];
  const parts = path.split("/").filter(Boolean);
  let dirs = [join(SRC, "app")];
  for (const part of parts) {
    const next: string[] = [];
    for (const d of dirs) {
      if (!existsSync(d)) continue;
      for (const f of readdirSync(d)) {
        const full = join(d, f);
        if (!statSync(full).isDirectory()) continue;
        if (f === part || (f.startsWith("[") && f.endsWith("]")) || (f.startsWith("(") && f.endsWith(")"))) next.push(full);
      }
    }
    dirs = next;
  }
  return dirs.some((d) => existsSync(join(d, "page.tsx")));
}

describe("organization playbooks", () => {
  it("have unique ids, steps and valid next links", () => {
    const ids = PLAYBOOKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PLAYBOOKS) {
      expect(p.steps.length, p.id).toBeGreaterThan(0);
      for (const n of p.next ?? []) expect(ids, `${p.id} -> ${n}`).toContain(n);
    }
  });

  it("point at pages that exist", () => {
    for (const p of PLAYBOOKS) for (const s of p.steps) if (s.href) expect(routeExists(s.href), `${p.id}: ${s.href}`).toBe(true);
  });

  it("only bold labels that exist in the interface code", () => {
    const missing: string[] = [];
    for (const p of PLAYBOOKS) for (const s of p.steps) for (const l of labels(s.text + " " + (s.tip ?? ""))) {
      // Labels in the interface are sometimes written with typographic marks or split by markup.
      if (!corpus.includes(l)) missing.push(`${p.id}: ${l}`);
    }
    expect(missing).toEqual([]);
  });

  it("are found by the questions an organization would ask", () => {
    const index = buildIndex(entriesForAudience([...DEFAULT_ENTRIES, ...playbookEntries()], "organization"), []);
    const cases: Record<string, string> = {
      "How do I upload a course?": "upload-course",
      "how can i post my course": "upload-course",
      "how do I add a module assessment": "module-assessment",
      "How do I set a module assessment?": "module-assessment",
      "how do i add trainees to my course": "enroll-trainees",
      "How do I design certificates with my logo?": "certificates",
      "show me around my organization workspace": "workspace-tour",
      "how do i post an event": "events",
      "how do I add a teammate to my organization?": "invite-team",
      "how do i create a final course exam": "final-exam",
    };
    for (const [q, id] of Object.entries(cases)) {
      const r = answerQuestion(q, index, ON);
      expect(r.kind, q).toBe("playbook");
      expect(r.playbookId, q).toBe(id);
    }
  });

  it("leave the ordinary answers alone", () => {
    const index = buildIndex([...DEFAULT_ENTRIES, ...playbookEntries()], []);
    for (const q of ["How do I create an account?", "How do I verify a certificate?", "Is it free to join?"]) {
      expect(answerQuestion(q, index, ON).kind, q).not.toBe("playbook");
    }
  });

  it("are found by the questions a trainee would ask", () => {
    const index = buildIndex(entriesForAudience([...DEFAULT_ENTRIES, ...playbookEntries()], "trainee"), []);
    const cases: Record<string, string> = {
      "Show me around my trainee dashboard": "trainee-tour",
      "how do i get started as a trainee": "trainee-start",
      "How do I enroll in a course?": "trainee-enroll",
      "how do i pay for a course": "trainee-enroll",
      "How do I take lessons and unlock the next module?": "trainee-learn",
      "How do I take a module assessment?": "trainee-assessment",
      "how do i take the course examination": "trainee-exam",
      "how do I submit an assignment": "trainee-assignment",
      "how do i print my certificate": "trainee-certificate",
      "how do I choose who can see my profile": "trainee-profile",
      "how do i answer an employer introduction": "trainee-jobs",
      "how do i message my instructor": "trainee-help",
      "how do I change my notifications": "trainee-settings",
    };
    for (const [q, id] of Object.entries(cases)) {
      const r = answerQuestion(q, index, ON);
      expect(r.playbookId, q).toBe(id);
    }
  });

  it("never take over a plain written answer, for any kind of account", () => {
    for (const me of [null, "trainee", "organization"]) {
      const index = buildIndex(entriesForAudience([...DEFAULT_ENTRIES, ...playbookEntries()], me), []);
      for (const e of DEFAULT_ENTRIES) {
        const r = answerQuestion(e.question, index, ON);
        expect(r.kind, `${me}: ${e.question}`).not.toBe("playbook");
      }
    }
  });

  it("keep organization guides away from trainees and the reverse", () => {
    const asTrainee = entriesForAudience(playbookEntries(), "trainee").map((e) => e.audience);
    expect(asTrainee.every((a) => a === "trainee")).toBe(true);
    const asOrg = entriesForAudience(playbookEntries(), "organization").map((e) => e.audience);
    expect(asOrg.every((a) => a === "organization")).toBe(true);
    expect(entriesForAudience(playbookEntries(), null).every((e) => e.audience === "trainee")).toBe(true);
  });
});
