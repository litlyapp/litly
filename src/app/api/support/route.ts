import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("organizer_profiles")
    .select("id, name")
    .eq("user_id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Organizers only" }, { status: 403 });

  const { subject, message } = await req.json();
  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
  }

  const formData = new FormData();
  formData.append("from", `litly Support <support@thelitlyapp.com>`);
  formData.append("to", "knuth.cdgo@gmail.com");
  formData.append("reply-to", user.email!);
  formData.append("subject", `[litly Support] ${subject}`);
  formData.append(
    "text",
    `From: ${profile.name} <${user.email}>\n\n${message}`
  );

  const credentials = Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString("base64");
  const res = await fetch("https://api.mailgun.net/v3/thelitlyapp.com/messages", {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Mailgun error:", err);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
