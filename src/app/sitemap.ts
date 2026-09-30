import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data: events } = await supabase
    .from("events")
    .select("id, updated_at")
    .eq("is_cancelled", false)
    .neq("is_published", false)
    .gte("date_time", sixMonthsAgo.toISOString())
    .order("date_time", { ascending: false });

  const { data: organizers } = await supabase
    .from("organizer_profiles")
    .select("id");

  const now = new Date();

  const eventUrls = (events ?? []).map((e) => ({
    url: `https://thelitlyapp.com/events/${e.id}`,
    lastModified: new Date(e.updated_at),
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
    {
      url: "https://thelitlyapp.com/events/calendar",
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: "https://thelitlyapp.com/about",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: "https://thelitlyapp.com/support",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    ...["privacy", "terms"].map((page) => ({
      url: `https://thelitlyapp.com/${page}`,
      lastModified: new Date("2026-09-30"), // effective date on the page
      changeFrequency: "yearly" as const,
      priority: 0.2,
    })),
    ...eventUrls,
    ...organizerUrls,
  ];
}
