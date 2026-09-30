"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

// One-time auth/invite secrets that appear in URLs — never send them to analytics
const SENSITIVE_PARAMS = ["token_hash", "token", "invite", "code", "type"];

function redact(event: BeforeSendEvent): BeforeSendEvent {
  const url = new URL(event.url);
  for (const key of SENSITIVE_PARAMS) url.searchParams.delete(key);
  return { ...event, url: url.toString() };
}

export default function PrivateAnalytics() {
  return <Analytics beforeSend={redact} />;
}
