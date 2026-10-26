import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Filtered list/map views and the month calendar are endless URL
      // permutations (genre × date × month…) — crawlers walked the calendar
      // out to the year 2249. Plain /events and each /events/[id] stay open.
      disallow: [
        "/admin/",
        "/dashboard/",
        "/saved/",
        "/api/",
        "/events/calendar",
        "/events?",
        "/events/map?",
      ],
    },
    sitemap: "https://thelitlyapp.com/sitemap.xml",
  };
}
