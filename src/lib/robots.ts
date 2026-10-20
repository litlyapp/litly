import { safeFetch } from "@/lib/safeUrl";
import { importerRequestHeaders } from "@/lib/webBotAuth";

// Product token sites use to address the importer in robots.txt
export const IMPORTER_ROBOTS_TOKEN = "litly-importer";

type Rule = { allow: boolean; path: string };

// Parses robots.txt into the rules for `token`, falling back to `*` (RFC 9309 §2.2.1).
function rulesFor(robotsTxt: string, token: string): Rule[] {
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;
  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();
    if (field === "user-agent") {
      if (!current || !lastWasAgent) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((field === "allow" || field === "disallow") && current) {
      if (value) current.rules.push({ allow: field === "allow", path: value });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }
  const mine = groups.filter((g) => g.agents.includes(token));
  const chosen = mine.length ? mine : groups.filter((g) => g.agents.includes("*"));
  return chosen.flatMap((g) => g.rules);
}

function ruleMatches(rulePath: string, path: string): boolean {
  const anchored = rulePath.endsWith("$");
  const pattern = (anchored ? rulePath.slice(0, -1) : rulePath)
    .split("*")
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${pattern}${anchored ? "$" : ""}`).test(path);
}

// Longest matching rule wins; Allow wins ties (RFC 9309 §2.2.2).
export function isPathAllowed(robotsTxt: string, path: string, token = IMPORTER_ROBOTS_TOKEN): boolean {
  let best: Rule | null = null;
  for (const rule of rulesFor(robotsTxt, token)) {
    if (!ruleMatches(rule.path, path)) continue;
    if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow)) {
      best = rule;
    }
  }
  return best ? best.allow : true;
}

// Whether the site's robots.txt lets the importer fetch `url`. Per RFC 9309, an
// unreachable or 4xx robots.txt means no restrictions; a 5xx means assume disallowed.
export async function importerAllowedByRobots(url: string): Promise<boolean> {
  const target = new URL(url);
  let res: Response;
  try {
    res = await safeFetch(
      `${target.origin}/robots.txt`,
      { signal: AbortSignal.timeout(5000) },
      importerRequestHeaders,
    );
  } catch {
    return true;
  }
  if (res.status >= 500) return false;
  if (!res.ok) return true;
  const body = (await res.text()).slice(0, 500_000);
  // A bot challenge in place of robots.txt tells us nothing about the rules
  if (/<html/i.test(body.slice(0, 1000))) return true;
  return isPathAllowed(body, target.pathname + target.search);
}
