/**
 * M40 — audit finding, fixed here: the download route makes a real
 * server-side fetch against `material.url`, which is staff-provided,
 * not trainee-provided — but staff (SUPER_ADMIN/ADMIN/INSTRUCTOR) is
 * still a lower trust boundary than "this server's own code," and
 * `safeUrl` (materialUrl.ts) only ever checked the URL's protocol,
 * never its destination. A material URL pointing at an internal or
 * cloud-metadata address (the classic SSRF target — AWS/GCP/Azure's
 * metadata endpoint at 169.254.169.254 can expose real credentials to
 * whatever fetches it) would previously have been fetched by this
 * server without question, then streamed straight back to whoever
 * requested the "download."
 *
 * Resolves the hostname via real DNS and checks the ACTUAL resolved
 * address, not just the literal string in the URL — a domain name can
 * resolve to a private IP just as easily as a URL can spell one out
 * directly, and checking only the literal string would miss that.
 *
 * Honest about the real limit of this defense: this is a check
 * performed before the real fetch, not a guarantee that the same
 * address is what's connected to a moment later — a sophisticated
 * DNS-rebinding attack (the name resolving to something else between
 * this check and the actual connection) isn't defended against here,
 * since that needs a custom fetch agent validating the connection
 * itself, real additional infrastructure this fix doesn't build.
 * What this closes is the far more likely real risk: a material URL
 * that's obviously, directly a private or metadata address.
 */
import { lookup } from "dns/promises";
import { isIP } from "net";

function ipToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => acc * 256 + Number(octet), 0);
}

const BLOCKED_IPV4_RANGES: Array<[number, number]> = [
  [ipToInt("0.0.0.0"), ipToInt("0.255.255.255")], // "this network"
  [ipToInt("10.0.0.0"), ipToInt("10.255.255.255")], // private
  [ipToInt("100.64.0.0"), ipToInt("100.127.255.255")], // carrier-grade NAT
  [ipToInt("127.0.0.0"), ipToInt("127.255.255.255")], // loopback
  [ipToInt("169.254.0.0"), ipToInt("169.254.255.255")], // link-local — cloud metadata lives here
  [ipToInt("172.16.0.0"), ipToInt("172.31.255.255")], // private
  [ipToInt("192.168.0.0"), ipToInt("192.168.255.255")], // private
  [ipToInt("198.18.0.0"), ipToInt("198.19.255.255")], // benchmarking
];

function isBlockedIpv4(ip: string): boolean {
  const value = ipToInt(ip);
  return BLOCKED_IPV4_RANGES.some(([start, end]) => value >= start && value <= end);
}

function isBlockedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" || // loopback
    normalized === "::" || // unspecified
    normalized.startsWith("fe80:") || // link-local
    normalized.startsWith("fc") || // unique local (fc00::/7)
    normalized.startsWith("fd")
  );
}

/**
 * Resolves the URL's hostname and returns true only if every resolved
 * address is a genuinely public one. Fails closed — a lookup error, an
 * unresolvable hostname, or no addresses at all all return false
 * (unsafe) rather than being treated as safe by default.
 */
export async function isPubliclyFetchableUrl(url: string): Promise<boolean> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }
  if (hostname.toLowerCase() === "localhost") return false;

  try {
    const family = isIP(hostname);
    const addresses =
      family !== 0 ? [{ address: hostname, family: family as 4 | 6 }] : await lookup(hostname, { all: true });

    if (addresses.length === 0) return false;
    return addresses.every(({ address, family: f }) => (f === 4 ? !isBlockedIpv4(address) : !isBlockedIpv6(address)));
  } catch {
    return false;
  }
}
