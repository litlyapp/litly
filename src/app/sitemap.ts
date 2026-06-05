import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select("id, updated_at")
    .order("date_time", { ascending: false });

  const { data: organizers } = await supabase
    .from("organizer_profiles")
    .select("id, updated_at");

  const eventUrls = (events ?? []).map((e) => ({
    url: `https://thelitlyapp.com/events/${e.id}`,
    lastModified: new Date(e.updated_at),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const organizerUrls = (organizers ?? []).map((o) => ({
    url: `https://thelitlyapp.com/organizers/${o.id}`,
    lastModified: new Date(o.updated_at),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [
    {
      url: "https://thelitlyapp.com",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: "https://thelitlyapp.com/events",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: "https://thelitlyapp.com/events/map",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    ...eventUrls,
    ...organizerUrls,
  ];
}
