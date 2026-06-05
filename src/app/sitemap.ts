import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select("id")
    .order("date_time", { ascending: false });

  const { data: organizers } = await supabase
    .from("organizer_profiles")
    .select("id");

  const now = new Date();

  const eventUrls = (events ?? []).map((e) => ({
    url: `https://thelitlyapp.com/events/${e.id}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const organizerUrls = (organizers ?? []).map((o) => ({
    url: `https://thelitlyapp.com/organizers/${o.id}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [
    {
      url: "https://thelitlyapp.com",
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: "https://thelitlyapp.com/events",
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: "https://thelitlyapp.com/events/map",
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    },
    ...eventUrls,
    ...organizerUrls,
  ];
}
