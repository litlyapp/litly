import type { Genre } from "@/types/database";

export const GENRES: { value: Genre; label: string }[] = [
  { value: "poetry", label: "Poetry" },
  { value: "fiction", label: "Fiction" },
  { value: "nonfiction", label: "Nonfiction" },
  { value: "essay", label: "Essay" },
  { value: "hybrid_experimental", label: "Hybrid / Experimental" },
  { value: "translation", label: "Translation" },
  { value: "ya", label: "YA" },
  { value: "craft_talk", label: "Craft Talk" },
  { value: "open_mic", label: "Open Mic" },
  { value: "workshop", label: "Workshop" },
];

export const GENRE_LABELS: Record<Genre, string> = Object.fromEntries(
  GENRES.map(({ value, label }) => [value, label])
) as Record<Genre, string>;
