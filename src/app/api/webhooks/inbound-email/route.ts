import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { LITLY_INBOX } from "@/lib/email";

const CONFIRMATION_FORWARD_TO = LITLY_INBOX;

// Human-facing inboxes: real correspondence, not newsletters. Mail to these is
// forwarded straight to the personal inbox under its own address label.
const HUMAN_INBOXES = [
  "contact@thelitlyapp.com",
  "support@thelitlyapp.com",
  "privacy@thelitlyapp.com",
  "admin@thelitlyapp.com",
];

function verifyMailgunSignature(timestamp: string, token: string, signature: string): boolean {
  const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
  if (!signingKey) return false; // reject all requests if key is not configured

  // Reject if timestamp is more than 5 minutes old (replay protection)
  const tsSeconds = parseInt(timestamp, 10);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (isNaN(tsSeconds) || Math.abs(nowSeconds - tsSeconds) > 300) return false;

  const value = timestamp + token;
  const expected = createHmac("sha256", signingKey).update(value).digest("hex");
  return expected === signature;
}

async function forwardToGmail(
  from: string,
  subject: string,
  bodyPlain: string,
  bodyHtml: string,
  sentTo = "newsletters@thelitlyapp.com"
) {
  const formData = new FormData();
  // Show the address it actually arrived at as the From, so contact@ / support@
  // / privacy@ are distinguishable in the inbox at a glance.
  formData.append("from", `litly <${sentTo}>`);
  // Deliver straight to the litly inbox. (We previously tried putting the routed
  // address in To + Bcc'ing the inbox so Gmail would auto-select the reply-from,
  // but that From/To-same-domain + Bcc pattern got flagged as spam. Reliable
  // receipt matters more than auto-select — pick the From manually on reply.)
  formData.append("to", CONFIRMATION_FORWARD_TO);
  // Reply goes straight back to whoever wrote in, not to litly's own address.
  if (from) formData.append("h:Reply-To", from);
  formData.append("subject", `[litly fwd] ${subject}`);
  formData.append("text", `Originally from: ${from}\nSent to: ${sentTo}\n\n${bodyPlain}`);
  if (bodyHtml) formData.append("html", bodyHtml);

  const credentials = Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString("base64");
  const res = await fetch("https://api.mailgun.net/v3/thelitlyapp.com/messages", {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}` },
    body: formData,
  });
  if (!res.ok) {
    console.error("[inbound-email] forwardToGmail failed:", await res.text());
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    // Verify Mailgun webhook signature
    const timestamp = formData.get("timestamp")?.toString() ?? "";
    const token = formData.get("token")?.toString() ?? "";
    const signature = formData.get("signature")?.toString() ?? "";
    if (!verifyMailgunSignature(timestamp, token, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const from = formData.get("from")?.toString() ?? "";
    const subject = formData.get("subject")?.toString() ?? "";
    const bodyPlain = formData.get("body-plain")?.toString() ?? "";
    const bodyHtml = formData.get("body-html")?.toString() ?? "";

    // Ignore litly's own outbound mail (RSVP confirmations, digests, alerts)
    // looping back in via the catch-all — e.g. when an admin@thelitlyapp.com
    // account RSVPs to an event
    if (/@thelitlyapp\.com/i.test(from)) {
      return NextResponse.json({ ok: true, skipped: "self-sent email" });
    }

    // Human-addressed mail (contact/support/privacy/admin) is correspondence —
    // forward to the litly inbox under its own address label.
    const recipient = (formData.get("recipient")?.toString() ?? "").toLowerCase();
    const humanInbox = HUMAN_INBOXES.find((addr) => recipient.includes(addr));
    if (humanInbox) {
      await forwardToGmail(from, subject, bodyPlain, bodyHtml, humanInbox);
      return NextResponse.json({ ok: true, forwarded: humanInbox });
    }

    // Everything else (newsletters, event announcements, confirmation mail)
    // forwards to the litly inbox for manual review — no auto-parsing.
    await forwardToGmail(from, subject, bodyPlain, bodyHtml);
    return NextResponse.json({ ok: true, forwarded: "newsletters@thelitlyapp.com" });
  } catch (error) {
    console.error("Inbound email webhook error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
