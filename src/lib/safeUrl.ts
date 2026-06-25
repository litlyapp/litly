import { lookup } from "node:dns/promises";

const PRIVATE_IP = [
  /^127\./,                         // loopback
  /^10\./,                          // RFC 1918
  /^172\.(1[6-9]|2[0-9]|3[01])\./,  // RFC 1918
  /^192\.168\./,                    // RFC 1918
  /^169\.254\./,                    // link-local (AWS metadata, etc.)
  /^0\./,                           // "this" network
  /^::1$/,                          // IPv6 loopback
  /^::ffff:/i,                      // IPv4-mapped IPv6 (e.g. ::ffff:192.168.1.1)
  /^fc[0-9a-f]{2}:/i,               // IPv6 unique local
  /^fd[0-9a-f]{2}:/i,               // IPv6 unique local
  /^fe80:/i,                        // IPv6 link-local
];

function isPrivateIp(addr: string): boolean {
  return PRIVATE_IP.some((r) => r.test(addr));
}

/**
 * Returns true only if `urlStr` is an http/https URL whose hostname resolves
 * to a public IP. Blocks RFC-1918, loopback, and link-local targets to prevent
 * server-side request forgery.
 *
 * DNS resolution and the subsequent fetch are separate calls, so a DNS-rebinding
 * attack is theoretically possible. For this app's threat model that risk is
 * acceptable — the check stops the common case of internal IP targeting.
 */
export async function isSafeUrl(urlStr: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

  // WHATWG URL wraps IPv6 literals in brackets: "[::1]" — strip them so the
  // regex patterns below and dns.lookup both receive the bare address.
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");

  if (isPrivateIp(hostname)) return false; // reject literal private IPs immediately
  try {
    const { address } = await lookup(hostname);
    return !isPrivateIp(address);
  } catch {
    return false; // unresolvable hostname = reject
  }
}
