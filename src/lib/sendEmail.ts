const LOGO_URL = "https://thelitlyapp.com/logo.png";

// Escape user-controlled content before inserting into HTML email bodies
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export function emailWrapper(body: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1B2A3E">
      <tr><td align="center" style="padding:0">
        <table width="520" cellpadding="0" cellspacing="0" border="0" bgcolor="#F2E8D5" style="max-width:520px;width:100%">
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
  if (!process.env.MAILGUN_API_KEY) {
    console.error("[sendEmail] MAILGUN_API_KEY is not configured");
    throw new Error("Email service not configured");
  }

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

/**
 * Send one email to many recipients in a single Mailgun API call (chunked at
 * Mailgun's 1,000-recipient batch limit). Passing recipient-variables makes
 * Mailgun deliver an individual message to each address — recipients never
 * see each other. Per-recipient substitutions appear in the template as
 * %recipient.key%.
 */
export async function sendBatchEmail({
  recipients,
  subject,
  text,
  html,
}: {
  recipients: { email: string; vars?: Record<string, string> }[];
  subject: string;
  text: string;
  html?: string;
}) {
  if (!process.env.MAILGUN_API_KEY) {
    console.error("[sendBatchEmail] MAILGUN_API_KEY is not configured");
    throw new Error("Email service not configured");
  }
  if (recipients.length === 0) return;

  const credentials = Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString("base64");
  let failedChunks = 0;

  for (let i = 0; i < recipients.length; i += 1000) {
    const chunk = recipients.slice(i, i + 1000);

    const formData = new FormData();
    formData.append("from", "litly <noreply@thelitlyapp.com>");
    for (const r of chunk) formData.append("to", r.email);
    formData.append("subject", subject);
    formData.append("text", text);
    if (html) formData.append("html", html);

    const recipientVariables: Record<string, Record<string, string>> = {};
    for (const r of chunk) recipientVariables[r.email] = r.vars ?? {};
    formData.append("recipient-variables", JSON.stringify(recipientVariables));

    const res = await fetch("https://api.mailgun.net/v3/thelitlyapp.com/messages", {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}` },
      body: formData,
    });

    if (!res.ok) {
      failedChunks++;
      console.error(`[sendBatchEmail] Mailgun error (chunk ${i / 1000 + 1}):`, await res.text());
    }
  }

  if (failedChunks > 0) {
    throw new Error(`Failed to send ${failedChunks} batch email chunk(s)`);
  }
}
