import { describe, it, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";
import { randomBytes } from "node:crypto";
import { MAX_WIDTH, worthChecking, worthReplacing, prettyBytes } from "@/lib/pictures/core";

describe("which pictures are worth shrinking", () => {
  it("leaves small pictures alone, with a higher bar for wide ones", () => {
    expect(worthChecking("TRAINEE_AVATAR", 30 * 1024)).toBe(false);
    expect(worthChecking("TRAINEE_AVATAR", 200 * 1024)).toBe(true);
    expect(worthChecking("ORG_COVER", 200 * 1024)).toBe(false);
    expect(worthChecking("ORG_COVER", 900 * 1024)).toBe(true);
  });
  it("uses the new file only when it is clearly smaller", () => {
    expect(worthReplacing(1000, 800)).toBe(true);
    expect(worthReplacing(1000, 900)).toBe(false);
    expect(worthReplacing(1000, 0)).toBe(false);
  });
  it("matches the widths the picture editor saves", () => {
    expect(MAX_WIDTH.TRAINEE_AVATAR).toBe(480);
    expect(MAX_WIDTH.COURSE_FLYER).toBe(1280);
    expect(MAX_WIDTH.ORG_COVER).toBe(1600);
  });
  it("writes sizes people can read", () => {
    expect(prettyBytes(2048)).toBe("2 KB");
    expect(prettyBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});

// ---- the real resizing, and the batch with storage and the database stood in
const rows = { trainee: [{ id: "t1", avatarUrl: "https://s.public.blob.vercel-storage.com/avatars/old.png" }, { id: "t2", avatarUrl: "https://s.public.blob.vercel-storage.com/avatars/tiny.png" }] as { id: string; avatarUrl: string }[] };
const updated: Array<{ id: string; url: string }> = [];
const deleted: string[] = [];
let used = 0;
let skipStore: unknown = {};

vi.mock("@/lib/prisma", () => {
  const empty = { findMany: async () => [], count: async () => used, update: async () => ({}) };
  return {
    prisma: {
      user: empty, employer: empty, startup: empty, course: empty, trainingOrganization: empty, organizationPublicProfile: empty, certificateTemplate: empty, adBooking: empty,
      trainee: { findMany: async () => rows.trainee, count: async () => used, update: async ({ where, data }: { where: { id: string }; data: { avatarUrl: string } }) => { updated.push({ id: where.id, url: data.avatarUrl }); return {}; } },
      growthSetting: { findUnique: async () => ({ config: skipStore }), upsert: async ({ update }: { update: { config: unknown } }) => { skipStore = update.config; return {}; } },
      growthAudit: { create: async () => ({}) },
    },
  };
});
vi.mock("@vercel/blob", () => ({ put: vi.fn(async (p: string) => ({ url: `https://s.public.blob.vercel-storage.com/${p}` })), del: vi.fn(async (u: string) => { deleted.push(u); }) }));

import { shrinkBuffer, shrinkBatch, scanPictures } from "@/lib/pictures/shrink";

async function noisy(w: number, h: number) {
  const raw = randomBytes(w * h * 3);
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}

describe("resizing", () => {
  it("makes a big picture a small WebP no wider than allowed, and never enlarges", async () => {
    const big = await noisy(1800, 1200);
    const out = await shrinkBuffer(big, 480);
    const meta = await sharp(out.buffer).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(480);
    expect(out.buffer.length).toBeLessThan(big.length / 3);
    const small = await shrinkBuffer(await noisy(200, 100), 480);
    expect(small.width).toBe(200);
  });
});

describe("shrinking the stored pictures", () => {
  beforeEach(() => {
    updated.length = 0; deleted.length = 0; used = 0; skipStore = {};
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: { method?: string }) => {
      const big = url.includes("old");
      const body = await noisy(big ? 1800 : 120, big ? 1200 : 120);
      if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-length": String(big ? body.length : 5000) } });
      return new Response(new Uint8Array(body), { status: 200 });
    }));
  });

  it("lists only the large pictures", async () => {
    const s = await scanPictures();
    expect(s.total).toBe(2);
    expect(s.candidates.map((c) => c.id)).toEqual(["t1"]);
  });

  it("points the record at the smaller file and removes the old one", async () => {
    const s = await scanPictures();
    const r = await shrinkBatch("admin", s.candidates);
    expect(r.shrunk).toBe(1);
    expect(r.savedBytes).toBeGreaterThan(0);
    expect(updated).toHaveLength(1);
    expect(updated[0].url).toMatch(/\/pictures\/trainee_avatar-t1-.*\.webp$/);
    expect(deleted).toEqual(["https://s.public.blob.vercel-storage.com/avatars/old.png"]);
  });

  it("keeps the old file when something else still uses it", async () => {
    used = 1;
    const s = await scanPictures();
    await shrinkBatch("admin", s.candidates);
    expect(updated).toHaveLength(1);
    expect(deleted).toHaveLength(0);
  });

  it("does not touch a picture that cannot be read, and does not retry it forever", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (_u: string, init?: { method?: string }) => (init?.method === "HEAD" ? new Response(null, { status: 200, headers: { "content-length": "900000" } }) : new Response("nope", { status: 404 })));
    const first = await scanPictures();
    const r = await shrinkBatch("admin", first.candidates);
    expect(r.failed).toBe(2);
    expect(updated).toHaveLength(0);
    expect((await scanPictures()).large).toBe(0);
  });
});
