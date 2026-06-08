import { NextResponse } from "next/server";
import { sendEmail, emailWrapper } from "@/lib/sendEmail";

// Temporary test route — remove after previewing emails
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const to = searchParams.get("to") ?? "knuth.cdgo@gmail.com";

  if (type === "rsvp") {
    await sendEmail({
      to,
      subject: `You're going to An Evening of Poetry & Prose`,
      text: `You're confirmed for An Evening of Poetry & Prose.`,
      html: emailWrapper(`
        <h1 style="font-size:24px;margin:0 0 8px;color:#1B2A3E">You're going to<br/><em>An Evening of Poetry & Prose</em></h1>
        <p style="color:#5a4a3a;margin:0 0 24px">Your RSVP is confirmed.</p>
        <table style="border-collapse:collapse;width:100%;margin-bottom:24px">
          <tr><td style="padding:8px 0;color:#7a6a5a;width:90px">Date</td><td style="padding:8px 0;color:#1B2A3E">Thu, Jun 19, 2026</td></tr>
          <tr><td style="padding:8px 0;color:#7a6a5a">Time</td><td style="padding:8px 0;color:#1B2A3E">7:00 PM</td></tr>
          <tr><td style="padding:8px 0;color:#7a6a5a">Location</td><td style="padding:8px 0;color:#1B2A3E">The Regulator Bookshop, Durham, NC</td></tr>
        </table>
        <a href="https://thelitlyapp.com" style="background:#E8622A;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600">View event</a>
        <p style="margin-top:32px;font-size:12px;color:#7a6a5a">You received this because you RSVPd on litly.</p>
      `),
    });
    return NextResponse.json({ ok: true, sent: "rsvp confirmation" });
  }

  if (type === "digest") {
    await sendEmail({
      to,
      subject: `Your weekly litly digest — 5 new RSVPs`,
      text: `Weekly digest test`,
      html: emailWrapper(`
        <h1 style="font-size:22px;margin:0 0 8px;color:#1B2A3E">Your weekly digest</h1>
        <p style="color:#5a4a3a;margin:0 0 24px">Hi The Regulator, here's what happened this week.</p>
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid #d4c9b5">
              <a href="https://thelitlyapp.com" style="color:#1B2A3E;font-weight:600;text-decoration:none">An Evening of Poetry & Prose</a><br/>
              <span style="color:#7a6a5a;font-size:13px">Thu, Jun 19, 2026 · The Regulator Bookshop, Durham, NC</span>
            </td>
            <td style="padding:12px 0;border-bottom:1px solid #d4c9b5;text-align:right;white-space:nowrap">
              <strong style="color:#E8622A">3 new RSVPs</strong>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid #d4c9b5">
              <a href="https://thelitlyapp.com" style="color:#1B2A3E;font-weight:600;text-decoration:none">Fiction Workshop: Short Story Intensive</a><br/>
              <span style="color:#7a6a5a;font-size:13px">Sat, Jun 21, 2026 · Virtual</span>
            </td>
            <td style="padding:12px 0;border-bottom:1px solid #d4c9b5;text-align:right;white-space:nowrap">
              <strong style="color:#E8622A">2 new RSVPs</strong>
            </td>
          </tr>
        </table>
        <div style="margin-top:28px">
          <a href="https://thelitlyapp.com/dashboard" style="background:#E8622A;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600">View dashboard</a>
        </div>
        <p style="margin-top:32px;font-size:12px;color:#7a6a5a">Weekly digest from litly. Only sent when you have new RSVPs.</p>
      `),
    });
    return NextResponse.json({ ok: true, sent: "weekly digest" });
  }

  return NextResponse.json({ error: "Use ?type=rsvp or ?type=digest" }, { status: 400 });
}
