import type { Genre } from "@/types/database";

export const GENRES: { value: Genre; label: string }[] = [
  { value: "poetry", label: "Poetry" },
  { value: "fiction", label: "Fiction" },
  { value: "nonfiction", label: "Nonfiction" },
  { value: "translation", label: "Translation" },
  { value: "ya", label: "YA" },
  { value: "craft_talk", label: "Craft Talk" },
  { value: "open_mic", label: "Open Mic" },
  { value: "workshop", label: "Workshop" },
  { value: "in_conversation", label: "In Conversation" },
  { value: "slam", label: "Slam" },
  { value: "other", label: "Other" },
];

// Display labels, keyed by string (not Genre) so retired enum values still
// present on legacy events render sensibly instead of as a blank chip. "essay"
// was merged into "nonfiction"; Postgres can't drop the enum value, so we map
// it for display and convert the underlying data separately.
export const GENRE_LABELS: Record<string, string> = {
  ...Object.fromEntries(GENRES.map(({ value, label }) => [value, label])),
  essay: "Nonfiction",
  hybrid_experimental: "Hybrid / Experimental",
};
