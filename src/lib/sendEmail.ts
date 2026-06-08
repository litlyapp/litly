const LOGO_URL = "https://thelitlyapp.com/logo.png";

export function emailWrapper(body: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1B2A3E">
      <tr><td align="center" style="padding:0">
        <table width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%">
          <!-- Header -->
          <tr><td bgcolor="#1B2A3E" align="center" style="padding:24px 32px">
            <img src="${LOGO_URL}" alt="litly" width="80" height="80" style="display:block;border:0" />
          </td></tr>
          <!-- Body -->
          <tr><td bgcolor="#F2E8D5" style="padding:32px;font-family:Georgia,serif;color:#1B2A3E">
            ${body}
          </td></tr>
          <!-- Footer -->
          <tr><td bgcolor="#1B2A3E" align="center" style="padding:16px 32px;font-family:Georgia,serif;font-size:12px">
            <a href="https://thelitlyapp.com" style="color:#F2E8D5;opacity:0.7;text-decoration:none">thelitlyapp.com</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  `;
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const formData = new FormData();
  formData.append("from", "litly <noreply@thelitlyapp.com>");
  formData.append("to", to);
  formData.append("subject", subject);
  formData.append("text", text);
  if (html) formData.append("html", html);

  const credentials = Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString("base64");
  const res = await fetch("https://api.mailgun.net/v3/thelitlyapp.com/messages", {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Mailgun error:", err);
    throw new Error("Failed to send email");
  }
}
