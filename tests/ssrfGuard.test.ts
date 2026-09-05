import { describe, it, expect } from "vitest";
import { isPubliclyFetchableUrl } from "../src/lib/ssrfGuard";

describe("isPubliclyFetchableUrl", () => {
  it("rejects the AWS/GCP/Azure cloud metadata endpoint — the classic, real SSRF target this fix exists for", async () => {
    expect(await isPubliclyFetchableUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
  });

  it("rejects loopback addresses", async () => {
    expect(await isPubliclyFetchableUrl("http://127.0.0.1/internal")).toBe(false);
    expect(await isPubliclyFetchableUrl("http://127.0.0.1:5432/")).toBe(false);
  });

  it("rejects the literal hostname 'localhost'", async () => {
    expect(await isPubliclyFetchableUrl("http://localhost/internal")).toBe(false);
  });

  it("rejects private network ranges (10.x, 172.16-31.x, 192.168.x)", async () => {
    expect(await isPubliclyFetchableUrl("http://10.0.0.5/")).toBe(false);
    expect(await isPubliclyFetchableUrl("http://172.16.0.1/")).toBe(false);
    expect(await isPubliclyFetchableUrl("http://172.31.255.254/")).toBe(false);
    expect(await isPubliclyFetchableUrl("http://192.168.1.1/")).toBe(false);
  });

  it("does not falsely block a public address that merely starts with the same digits as a private range", async () => {
    // 172.32.x.x is genuinely public — only 172.16-31.x.x is the
    // private range. A sloppy string-prefix check (e.g. startsWith
    // "172.") would wrongly block this; a real numeric range check
    // correctly doesn't.
    expect(await isPubliclyFetchableUrl("http://172.32.0.1/")).toBe(true);
  });

  it("accepts a genuinely public IP address", async () => {
    expect(await isPubliclyFetchableUrl("http://8.8.8.8/")).toBe(true);
  });

  it("rejects IPv6 loopback and link-local addresses", async () => {
    expect(await isPubliclyFetchableUrl("http://[::1]/")).toBe(false);
    expect(await isPubliclyFetchableUrl("http://[fe80::1]/")).toBe(false);
  });

  it("fails closed (rejects) on a malformed URL rather than throwing", async () => {
    expect(await isPubliclyFetchableUrl("not a url")).toBe(false);
  });

  it("genuinely exercises the DNS-lookup path (not just the literal-IP fast path) against a real, resolvable public hostname", async () => {
    // Every case above used a literal IP, where isIP() short-circuits
    // before any DNS lookup happens — this is the one case that
    // actually resolves a real hostname and checks the returned
    // addresses, confirming that code path works too, not just
    // assumed to from the literal-IP tests passing.
    expect(await isPubliclyFetchableUrl("https://registry.npmjs.org/")).toBe(true);
  });
});
