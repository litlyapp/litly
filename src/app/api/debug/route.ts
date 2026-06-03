import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "NOT SET";
  return NextResponse.json({
    keyStart: key.slice(0, 10),
    keyLength: key.length,
  });
}
