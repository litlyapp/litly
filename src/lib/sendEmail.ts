const LOGO_URL = "https://thelitlyapp.com/logo.png";

export function emailWrapper(body: string): string {
  return `
    <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;background:#F2E8D5;color:#1B2A3E">
      <div style="background:#1B2A3E;padding:28px 32px;text-align:center">
        <img src="${LOGO_URL}" alt="litly" style="height:64px;width:auto;display:inline-block" />
      </div>
      <div style="padding:32px;background:#F2E8D5">
        ${body}
      </div>
      <div style="padding:16px 32px;background:#1B2A3E;font-size:12px;color:#F2E8D5;opacity:0.6;text-align:center">
        <a href="https://thelitlyapp.com" style="color:#F2E8D5">thelitlyapp.com</a>
      </div>
    </div>
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
