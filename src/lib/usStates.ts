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
