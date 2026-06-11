import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/rateLimit";

function domain(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const host = value.includes("://")
      ? new URL(value).hostname
      : value.split("@").pop() ?? "";
    return host.replace(/^www\./, "").toLowerCase() || null;
  } catch {
    return null;
  }
}

// Advisory only — surfaces a trust signal in the notification email for the
// curator to weigh. Deliberately NOT an enforced gate: plenty of legitimate
// small orgs run their series from Gmail or a venue's shared inbox.
function trustNote(email: string, website: string, sourceUrl: string | null): string {
  const emailDomain = domain(email);
  const siteDomain = domain(website);
  const sourceDomain = domain(sourceUrl);
  if (!emailDomain) return "⚠️ Could not parse email domain.";
  const freebie = /gmail|yahoo|outlook|hotmail|icloud|proton/.test(emailDomain);
  if (siteDomain && emailDomain === siteDomain) {
    return `✅ Email domain matches their stated website (${emailDomain}).`;
  }
  if (sourceDomain && emailDomain === sourceDomain) {
    return `✅ Email domain matches the event's source site (${emailDomain}).`;
  }
  if (freebie) {
    return `ℹ️ Personal email provider (${emailDomain}) — common for small orgs; verify via their website/socials.`;
  }
  return `⚠️ Email domain (${emailDomain}) doesn't match website${siteDomain ? ` (${siteDomain})` : ""} or source — worth a closer look.`;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`claim:${ip}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const { eventId, orgName, contactName, email, website, message } =
    await request.json();

  if (!eventId || !orgName?.trim() || !contactName?.trim() || !email?.trim()) {
    return NextResponse.json(
      { error: "Organization, name, and email are required." },
      { status: 400 }
    );
  }
  if (
    orgName.length > 120 ||
    contactName.length > 120 ||
    email.length > 254 ||
    (website ?? "").length > 300 ||
    (message ?? "").length > 2000
  ) {
    return NextResponse.json({ error: "A field is too long." }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: event } = await supabase
    .from("events")
    .select("id, title, date_time, source_name, source_url, is_imported")
    .eq("id", eventId)
    .eq("is_imported", true)
    .single();

  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  // How many other imported events share this source — approving one claim
  // likely means handing over all of them
  let siblingCount = 0;
  if (event.source_name) {
    const { count } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("is_imported", true)
      .eq("source_name", event.source_name)
      .neq("id", event.id);
    siblingCount = count ?? 0;
  }

  const text = `New claim request

Event: ${event.title}
https://thelitlyapp.com/events/${event.id}
Source: ${event.source_name ?? "(none)"}${event.source_url ? `\nSource URL: ${event.source_url}` : ""}
Other imported events with this source: ${siblingCount}

Claimant:
  Org/series: ${orgName.trim()}
  Name: ${contactName.trim()}
  Email: ${email.trim()}
  Website: ${website?.trim() || "(none)"}

Trust check: ${trustNote(email.trim(), website?.trim() ?? "", event.source_url)}

Message:
${message?.trim() || "(none)"}

To approve: reply asking them to register and create their org at
https://thelitlyapp.com/become-organizer (they'll be its admin — you never join),
then reassign the event(s) to their new org:
  update events set organizer_id = '<their_org_id>'
  where is_imported = true and source_name = '${(event.source_name ?? "").replace(/'/g, "''")}';`;

  const formData = new FormData();
  formData.append("from", "litly Claims <support@thelitlyapp.com>");
  formData.append("to", "knuth.cdgo@gmail.com");
  formData.append("reply-to", email.trim());
  formData.append("subject", `[litly Claim] ${orgName.trim()} → ${event.title}`);
  formData.append("text", text);

  const credentials = Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString("base64");
  const res = await fetch("https://api.mailgun.net/v3/thelitlyapp.com/messages", {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}` },
    body: formData,
  });

  if (!res.ok) {
    console.error("[claim] Mailgun error:", await res.text());
    return NextResponse.json({ error: "Failed to send. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
