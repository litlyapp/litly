export const STATE_ABBREVIATIONS: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
  MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

/**
 * Resolve free text ("NC", "nc", "North Carolina", "north carolina") to a US
 * state, or null if it isn't one.
 */
export function resolveUsState(text: string): { abbr: string; name: string } | null {
  const t = text.trim().replace(/\s+/g, " ");
  const upper = t.toUpperCase();
  if (STATE_ABBREVIATIONS[upper]) return { abbr: upper, name: STATE_ABBREVIATIONS[upper] };
  const lower = t.toLowerCase();
  for (const [abbr, name] of Object.entries(STATE_ABBREVIATIONS)) {
    if (name.toLowerCase() === lower) return { abbr, name };
  }
  return null;
}

// States (and DC) that lie entirely in one timezone. Split states — AK, FL,
// ID, IN, KS, KY, MI, ND, NE, OR, SD, TN, TX — are left out on purpose: their
// timezone depends on the city, so callers fall back to other signals.
const SINGLE_TIMEZONE_STATES: Record<string, string> = {
  CT: "America/New_York", DE: "America/New_York", DC: "America/New_York", GA: "America/New_York",
  ME: "America/New_York", MD: "America/New_York", MA: "America/New_York", NH: "America/New_York",
  NJ: "America/New_York", NY: "America/New_York", NC: "America/New_York", OH: "America/New_York",
  PA: "America/New_York", RI: "America/New_York", SC: "America/New_York", VT: "America/New_York",
  VA: "America/New_York", WV: "America/New_York",
  AL: "America/Chicago", AR: "America/Chicago", IL: "America/Chicago", IA: "America/Chicago",
  LA: "America/Chicago", MN: "America/Chicago", MS: "America/Chicago", MO: "America/Chicago",
  OK: "America/Chicago", WI: "America/Chicago",
  CO: "America/Denver", MT: "America/Denver", NM: "America/Denver", UT: "America/Denver",
  WY: "America/Denver", AZ: "America/Phoenix",
  CA: "America/Los_Angeles", NV: "America/Los_Angeles", WA: "America/Los_Angeles",
  HI: "Pacific/Honolulu",
};

/** IANA timezone for a US state that's entirely in one zone, else null. */
export function timezoneForState(state: string | null | undefined): string | null {
  const resolved = state ? resolveUsState(state) : null;
  return resolved ? SINGLE_TIMEZONE_STATES[resolved.abbr] ?? null : null;
}
