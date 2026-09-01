"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// globals.css makes <body> (not <html>/window) the real scroll container
// (see the `overflow: hidden` / `overflow-y: auto` split there). Next's
// built-in scroll-to-top-on-navigation targets window/documentElement, so it
// never resets body's scroll — a navigation to a NEW route (e.g. returning
// from /events/[id]/edit to /events/[id] after a save) can otherwise land on
// a page still scrolled to wherever the previous page left off, hiding
// content like the breadcrumb/edit controls above the fold.
//
// Rendered once in the root layout so it's mounted for the whole app and
// reacts to every pathname change, rather than depending on a specific
// page/flow to opt in.
export default function ScrollRestoration() {
  const pathname = usePathname();

  useEffect(() => {
    document.body.scrollTop = 0;
  }, [pathname]);

  return null;
}
