import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/sendEmail";

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
      html: `
        <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1B2A3E">
          <div style="background:#1B2A3E;padding:24px 32px">
            <span style="color:#F2E8D5;font-size:22px;font-weight:bold">litly</span>
          </div>
          <div style="padding:32px">
            <h1 style="font-size:24px;margin:0 0 8px">You're going to<br/><em>An Evening of Poetry & Prose</em></h1>
            <p style="color:#555;margin:0 0 24px">Your RSVP is confirmed.</p>
            <table style="border-collapse:collapse;width:100%;margin-bottom:24px">
              <tr><td style="padding:8px 0;color:#888;width:90px">Date</td><td style="padding:8px 0">Thu, Jun 19, 2026</td></tr>
              <tr><td style="padding:8px 0;color:#888">Time</td><td style="padding:8px 0">7:00 PM</td></tr>
              <tr><td style="padding:8px 0;color:#888">Location</td><td style="padding:8px 0">The Regulator Bookshop, Durham, NC</td></tr>
            </table>
            <a href="https://thelitlyapp.com" style="background:#E8622A;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600">View event</a>
          </div>
          <div style="padding:16px 32px;border-top:1px solid #eee;font-size:12px;color:#aaa">
            You received this because you RSVPd on litly. <a href="https://thelitlyapp.com" style="color:#aaa">thelitlyapp.com</a>
          </div>
        </div>
      `,
    });
    return NextResponse.json({ ok: true, sent: "rsvp confirmation" });
  }

  if (type === "digest") {
    await sendEmail({
      to,
      subject: `Your weekly litly digest — 5 new RSVPs`,
      text: `Weekly digest test`,
      html: `
        <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1B2A3E">
          <div style="background:#1B2A3E;padding:24px 32px">
            <span style="color:#F2E8D5;font-size:22px;font-weight:bold">litly</span>
          </div>
          <div style="padding:32px">
            <h1 style="font-size:22px;margin:0 0 8px">Your weekly digest</h1>
            <p style="color:#555;margin:0 0 24px">Hi The Regulator, here's what happened this week.</p>
            <table style="width:100%;border-collapse:collapse">
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #eee">
                  <a href="https://thelitlyapp.com" style="color:#1B2A3E;font-weight:600;text-decoration:none">An Evening of Poetry & Prose</a><br/>
                  <span style="color:#888;font-size:13px">Thu, Jun 19, 2026 · The Regulator Bookshop, Durham, NC</span>
                </td>
                <td style="padding:12px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">
                  <strong style="color:#E8622A">3 new RSVPs</strong>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #eee">
                  <a href="https://thelitlyapp.com" style="color:#1B2A3E;font-weight:600;text-decoration:none">Fiction Workshop: Short Story Intensive</a><br/>
                  <span style="color:#888;font-size:13px">Sat, Jun 21, 2026 · Virtual</span>
                </td>
                <td style="padding:12px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">
                  <strong style="color:#E8622A">2 new RSVPs</strong>
                </td>
              </tr>
            </table>
            <div style="margin-top:28px">
              <a href="https://thelitlyapp.com/dashboard" style="background:#E8622A;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600">View dashboard</a>
            </div>
          </div>
          <div style="padding:16px 32px;border-top:1px solid #eee;font-size:12px;color:#aaa">
            Weekly digest from <a href="https://thelitlyapp.com" style="color:#aaa">litly</a>. Only sent when you have new RSVPs.
          </div>
        </div>
      `,
    });
    return NextResponse.json({ ok: true, sent: "weekly digest" });
  }

  return NextResponse.json({ error: "Use ?type=rsvp or ?type=digest" }, { status: 400 });
}
