// Word-boundary profanity check for event submissions.
// Uses \b boundaries so "classic", "bass", "assess", etc. are NOT matched.
// Leet-speak variants (@ for a, 3 for e, etc.) are normalized before matching.

const BLOCKED_TERMS = [
  // Core profanity
  "fuck", "fucks", "fucked", "fucking", "fucker", "fuckers",
  "motherfuck", "motherfucker", "motherfuckers", "motherfucking",
  "shit", "shits", "shitted", "shitting", "shitter", "shitters", "shitty", "bullshit",
  "ass", "asses", "asshole", "assholes", "jackass", "jackasses", "dumbass", "dumbasses",
  "bitch", "bitches", "bitched", "bitching", "bitchy",
  "bastard", "bastards",
  "damn", "damned",
  "cunt", "cunts",
  "cock", "cocks", "cocksucker", "cocksuckers", "cockhead",
  "dick", "dicks", "dickhead", "dickheads",
  "pussy", "pussies",
  "prick", "pricks",
  "whore", "whores",
  "slut", "sluts",
  "wanker", "wankers",
  "twat", "twats",
  "arse", "arsehole", "arseholes",
  "tosser", "tossers",
  "bollocks",
  "bugger", "buggers",
  "piss", "pisses", "pissed", "pissing",
  "crap", "craps", "crapped", "crappy",
  "boner", "boners",
  "blowjob", "blowjobs",
  "handjob", "handjobs",
  "rimjob", "rimjobs",
  "cumshot", "cumshots",
  "gangbang", "gangbangs",
  "jizz",
  "cum",

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

export function checkContent(...fields: (string | null | undefined)[]): ModerationResult {
  const combined = normalize(fields.filter(Boolean).join(" "));
  const matches: string[] = [];

  for (const term of BLOCKED_TERMS) {
    // Word-boundary match; multi-word terms use space between words
    const pattern = new RegExp(`\\b${term.replace(/ /g, "\\s+")}\\b`, "i");
    if (pattern.test(combined) && !matches.includes(term)) {
      matches.push(term);
    }
  }

  return { blocked: matches.length > 0, matches };
}
