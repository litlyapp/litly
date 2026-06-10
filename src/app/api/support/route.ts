import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!rateLimit(`support:${user.id}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  // Any org member (admin or editor) can contact support — membership is
  // tracked in org_members, not legacy organizer_profiles.user_id
  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) return NextResponse.json({ error: "Organizers only" }, { status: 403 });

  const { data: profile } = await supabase
    .from("organizer_profiles")
    .select("name")
    .eq("id", membership.org_id)
    .single();
  const orgName = profile?.name ?? "(unknown org)";

  const { subject, message } = await req.json();
  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
  }
  if (subject.length > 200) {
    return NextResponse.json({ error: "Subject must be 200 characters or fewer" }, { status: 400 });
  }
  if (message.length > 5000) {
    return NextResponse.json({ error: "Message must be 5000 characters or fewer" }, { status: 400 });
  }

  const formData = new FormData();
  formData.append("from", `litly Support <support@thelitlyapp.com>`);
  formData.append("to", "knuth.cdgo@gmail.com");
  formData.append("reply-to", user.email ?? "");
  formData.append("subject", `[litly Support] ${subject}`);
  formData.append(
    "text",
    `From: ${orgName} <${user.email}>\n\n${message}`
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
