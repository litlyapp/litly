// Word-boundary profanity/slur check for event submissions.
// Uses \b boundaries so "classic", "bass", "assess", etc. are NOT matched.
// Leet-speak variants (@ for a, 3 for e, etc.) are normalized before matching.
//
// Two tiers:
//   BLOCKED_ALWAYS  — blocked everywhere (titles, names, bios, descriptions)
//   BLOCKED_STRICT  — blocked in titles/names only; allowed in descriptions & bios
//                     (e.g. book titles may legitimately reference these terms)

const BLOCKED_ALWAYS = [
  // Core profanity — f-word family
  "fuck", "fucks", "fucked", "fucking", "fucker", "fuckers", "fuckery",
  "motherfuck", "motherfucker", "motherfuckers", "motherfucking",
  "clusterfuck", "clusterfucks", "fuckhead", "fuckheads", "fuckwit", "fuckwits",
  "fucktard", "fucktards",

  // s-word family
  "shit", "shits", "shitted", "shitting", "shitter", "shitters", "shitty",
  "bullshit", "bullshits", "bullshitting", "bullshitter", "bullshitters",
  "dipshit", "dipshits", "shithead", "shitheads", "horseshit",

  // a-word family
  "ass", "asses", "asshole", "assholes", "asshat", "asshats",
  "jackass", "jackasses", "dumbass", "dumbasses", "smartass", "smartasses",
  "badass", "badasses", "fatass", "fatasses", "halfass", "halfassed",
  "asswipe", "asswipes", "assclown", "assclowns",

  // b-word family
  "bitch", "bitches", "bitched", "bitching", "bitchy", "bitchass",
  "sonofabitch", "sonsofbitches",
  "bastard", "bastards",

  // c-word family
  "cunt", "cunts", "cunting",
  "cock", "cocks", "cocksucker", "cocksuckers", "cockhead", "cockheads",
  "cockwomble", "cockwombles",

  // d-word family
  "dick", "dicks", "dickhead", "dickheads", "dickwad", "dickwads",
  "dickweed", "dickweeds",
  "damn", "damned",

  // p-word family
  "pussy", "pussies",
  "prick", "pricks",
  "piss", "pisses", "pissed", "pissing", "pisser", "pissers",

  // w/s/t families
  "whore", "whores", "whorish",
  "slut", "sluts", "slutty",
  "wanker", "wankers", "wanking",
  "twat", "twats",
  "tosser", "tossers",
  "twatwaffle", "twatwaffles",

  // British variants
  "arse", "arses", "arsehole", "arseholes",
  "bollocks",
  "bugger", "buggers", "buggered", "buggering",
  "bellend", "bellends",
  "muppet",

  // misc
  "crap", "craps", "crapped", "crappy",
  "boner", "boners",

  // Sexual acts
  "blowjob", "blowjobs",
  "handjob", "handjobs",
  "rimjob", "rimjobs",
  "cumshot", "cumshots",
  "gangbang", "gangbangs", "gangbanged", "gangbanging",
  "jizz",
  "cum", "cumming",
  "creampie", "creampies",
  "fisting",
  "teabagging",

  // Slurs — racial, ethnic, identity-based
  "nigger", "niggers", "nigga", "niggas",
  "chink", "chinks",
  "spic", "spics", "spick", "spicks",
  "kike", "kikes",
  "gook", "gooks",
  "wetback", "wetbacks",
  "beaner", "beaners",
  "cracker", "crackers",
  "honky", "honkies", "honkeys",
  "raghead", "ragheads",
  "towelhead", "towelheads",
  "sandnigger", "sandniggers",
  "fag", "fags", "faggot", "faggots",
  "dyke", "dykes",
  "tranny", "trannies",
  "retard", "retards", "retarded",
  "cripple", "cripples",
];

// Terms blocked only in strict contexts (titles, org names, display names).
// Allowed in descriptions and author bios, where literary/artistic references are common.
const BLOCKED_STRICT_ONLY = [
  "dildo", "dildos",
  "vibrator", "vibrators",
  "pornography", "porno", "pornos", "porn",
  "hentai",
  "nude", "nudes", "nudity",
  "naked",
  "stripper", "strippers", "strip club",
  "hooker", "hookers",
  "prostitute", "prostitutes", "prostitution",
  "escort", "escorts",
  "onlyfans",
];

// Normalize leet-speak: @ → a, 3 → e, 1 → i, 0 → o, $ → s, 5 → s
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/@/g, "a")
    .replace(/3/g, "e")
    .replace(/1/g, "i")
    .replace(/0/g, "o")
    .replace(/\$/g, "s")
    .replace(/5/g, "s")
    .replace(/!/g, "i")
    .replace(/\+/g, "t");
}

export interface ModerationResult {
  blocked: boolean;
  matches: string[];
}

function scan(terms: string[], combined: string): string[] {
  const matches: string[] = [];
  for (const term of terms) {
    const pattern = new RegExp(`\\b${term.replace(/ /g, "\\s+")}\\b`, "i");
    if (pattern.test(combined) && !matches.includes(term)) {
      matches.push(term);
    }
  }
  return matches;
}

// Strict check — use for titles, org names, display names, usernames.
// Blocks both the core list AND the literary/contextual terms.
export function checkContent(...fields: (string | null | undefined)[]): ModerationResult {
  const combined = normalize(fields.filter(Boolean).join(" "));
  const matches = [
    ...scan(BLOCKED_ALWAYS, combined),
    ...scan(BLOCKED_STRICT_ONLY, combined),
  ];
  return { blocked: matches.length > 0, matches };
}

// Relaxed check — use for descriptions and author bios.
// Only blocks the core list; literary/contextual terms are allowed.
export function checkContentRelaxed(...fields: (string | null | undefined)[]): ModerationResult {
  const combined = normalize(fields.filter(Boolean).join(" "));
  const matches = scan(BLOCKED_ALWAYS, combined);
  return { blocked: matches.length > 0, matches };
}
