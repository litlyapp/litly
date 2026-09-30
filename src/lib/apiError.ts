import { NextResponse } from "next/server";

/**
 * 500 response for an unexpected server/database failure. Logs the real error
 * (visible in Vercel logs) but returns a generic message, so Postgres details
 * like table, column, and policy names never reach the browser.
 */
export function serverError(context: string, error: unknown, message = "Something went wrong. Please try again.") {
  console.error(`[${context}]`, error);
  return NextResponse.json({ error: message }, { status: 500 });
}
