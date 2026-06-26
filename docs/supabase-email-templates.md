# Supabase Auth Email Templates (litly-branded)

These are the HTML templates for Supabase **Authentication → Emails** (auth emails are
sent by Supabase, NOT by `src/lib/sendEmail.ts` — that file only handles transactional
mail like RSVPs, support replies, invites, and batch sends).

**Styling (hybrid brand):** navy `#1B2A3E`, cream `#F2E8D5`, orange `#E8622A`, logo from
`https://thelitlyapp.com/logo.png`. Matches the site's hybrid font scheme: **headings use
Georgia `Georgia,'Times New Roman',Times,serif`** (serif), **body uses Libre Franklin
`'Libre Franklin',Helvetica,Arial,sans-serif`** (sans).

**Email font caveat:** Georgia is web-safe and renders everywhere (Gmail/Outlook included), so
headings show the intended serif. Gmail/Outlook strip *web* fonts like Libre Franklin, so most
recipients see the Helvetica/Arial body fallback — intentional, a clean sans matching the site.

**Variables:** keep `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .Email }}`, `{{ .NewEmail }}`
exactly as written; Supabase fills them in.

**Button style matches app transactional emails:** pill shape (`border-radius:999px`), 14px/600 weight, 12px 24px padding, inline `<a>` (no wrapping table).

---

## 1. Confirm signup — Subject: `Confirm your litly account`

```html
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1B2A3E"><tr><td align="center" style="padding:0">
  <table width="520" cellpadding="0" cellspacing="0" border="0" bgcolor="#F2E8D5" style="max-width:520px;width:100%">
    <tr><td bgcolor="#1B2A3E" align="center" style="padding:24px 32px">
      <img src="https://thelitlyapp.com/logo.png" alt="litly" width="80" height="80" style="display:block;border:0" />
    </td></tr>
    <tr><td bgcolor="#F2E8D5" style="padding:32px;font-family:'Libre Franklin',Helvetica,Arial,sans-serif;color:#1B2A3E">
      <h1 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',Times,serif;font-size:22px;color:#1B2A3E">Welcome to litly</h1>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#5a4a3a">Thanks for signing up. Click the button below to confirm your email address and finish creating your account.</p>
      <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#E8622A;color:#ffffff;padding:12px 24px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600;font-family:'Libre Franklin',Helvetica,Arial,sans-serif">Confirm email address</a>
      <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#7a6a5a">If you didn't create a litly account, you can safely ignore this email.</p>
    </td></tr>
    <tr><td bgcolor="#1B2A3E" align="center" style="padding:16px 32px;font-family:'Libre Franklin',Helvetica,Arial,sans-serif;font-size:12px">
      <a href="https://thelitlyapp.com" style="color:#F2E8D5;opacity:0.7;text-decoration:none">thelitlyapp.com</a>
    </td></tr>
  </table>
</td></tr></table>
```

## 2. Reset password — Subject: `Reset your litly password`

```html
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1B2A3E"><tr><td align="center" style="padding:0">
  <table width="520" cellpadding="0" cellspacing="0" border="0" bgcolor="#F2E8D5" style="max-width:520px;width:100%">
    <tr><td bgcolor="#1B2A3E" align="center" style="padding:24px 32px">
      <img src="https://thelitlyapp.com/logo.png" alt="litly" width="80" height="80" style="display:block;border:0" />
    </td></tr>
    <tr><td bgcolor="#F2E8D5" style="padding:32px;font-family:'Libre Franklin',Helvetica,Arial,sans-serif;color:#1B2A3E">
      <h1 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',Times,serif;font-size:22px;color:#1B2A3E">Reset your password</h1>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#5a4a3a">We received a request to reset your litly password. Click the button below to choose a new one.</p>
      <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#E8622A;color:#ffffff;padding:12px 24px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600;font-family:'Libre Franklin',Helvetica,Arial,sans-serif">Reset password</a>
      <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#7a6a5a">If you didn't request this, you can safely ignore this email — your password won't change.</p>
    </td></tr>
    <tr><td bgcolor="#1B2A3E" align="center" style="padding:16px 32px;font-family:'Libre Franklin',Helvetica,Arial,sans-serif;font-size:12px">
      <a href="https://thelitlyapp.com" style="color:#F2E8D5;opacity:0.7;text-decoration:none">thelitlyapp.com</a>
    </td></tr>
  </table>
</td></tr></table>
```

## 3. Magic Link — Subject: `Your litly login link`

```html
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1B2A3E"><tr><td align="center" style="padding:0">
  <table width="520" cellpadding="0" cellspacing="0" border="0" bgcolor="#F2E8D5" style="max-width:520px;width:100%">
    <tr><td bgcolor="#1B2A3E" align="center" style="padding:24px 32px">
      <img src="https://thelitlyapp.com/logo.png" alt="litly" width="80" height="80" style="display:block;border:0" />
    </td></tr>
    <tr><td bgcolor="#F2E8D5" style="padding:32px;font-family:'Libre Franklin',Helvetica,Arial,sans-serif;color:#1B2A3E">
      <h1 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',Times,serif;font-size:22px;color:#1B2A3E">Log in to litly</h1>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#5a4a3a">Click the button below to securely log in to your litly account. This link will expire shortly.</p>
      <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#E8622A;color:#ffffff;padding:12px 24px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600;font-family:'Libre Franklin',Helvetica,Arial,sans-serif">Log in to litly</a>
      <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#7a6a5a">If you didn't request this link, you can safely ignore this email.</p>
    </td></tr>
    <tr><td bgcolor="#1B2A3E" align="center" style="padding:16px 32px;font-family:'Libre Franklin',Helvetica,Arial,sans-serif;font-size:12px">
      <a href="https://thelitlyapp.com" style="color:#F2E8D5;opacity:0.7;text-decoration:none">thelitlyapp.com</a>
    </td></tr>
  </table>
</td></tr></table>
```

## 4. Change Email Address — Subject: `Confirm your new litly email`

```html
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1B2A3E"><tr><td align="center" style="padding:0">
  <table width="520" cellpadding="0" cellspacing="0" border="0" bgcolor="#F2E8D5" style="max-width:520px;width:100%">
    <tr><td bgcolor="#1B2A3E" align="center" style="padding:24px 32px">
      <img src="https://thelitlyapp.com/logo.png" alt="litly" width="80" height="80" style="display:block;border:0" />
    </td></tr>
    <tr><td bgcolor="#F2E8D5" style="padding:32px;font-family:'Libre Franklin',Helvetica,Arial,sans-serif;color:#1B2A3E">
      <h1 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',Times,serif;font-size:22px;color:#1B2A3E">Confirm your new email</h1>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#5a4a3a">You requested to change your litly email from <strong>{{ .Email }}</strong> to <strong>{{ .NewEmail }}</strong>. Click below to confirm the change.</p>
      <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#E8622A;color:#ffffff;padding:12px 24px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600;font-family:'Libre Franklin',Helvetica,Arial,sans-serif">Confirm new email</a>
      <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#7a6a5a">If you didn't request this change, you can safely ignore this email.</p>
    </td></tr>
    <tr><td bgcolor="#1B2A3E" align="center" style="padding:16px 32px;font-family:'Libre Franklin',Helvetica,Arial,sans-serif;font-size:12px">
      <a href="https://thelitlyapp.com" style="color:#F2E8D5;opacity:0.7;text-decoration:none">thelitlyapp.com</a>
    </td></tr>
  </table>
</td></tr></table>
```

## 5. Invite user — Subject: `You've been invited to litly`

```html
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1B2A3E"><tr><td align="center" style="padding:0">
  <table width="520" cellpadding="0" cellspacing="0" border="0" bgcolor="#F2E8D5" style="max-width:520px;width:100%">
    <tr><td bgcolor="#1B2A3E" align="center" style="padding:24px 32px">
      <img src="https://thelitlyapp.com/logo.png" alt="litly" width="80" height="80" style="display:block;border:0" />
    </td></tr>
    <tr><td bgcolor="#F2E8D5" style="padding:32px;font-family:'Libre Franklin',Helvetica,Arial,sans-serif;color:#1B2A3E">
      <h1 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',Times,serif;font-size:22px;color:#1B2A3E">You've been invited</h1>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#5a4a3a">You've been invited to join litly. Click the button below to accept the invitation and set up your account.</p>
      <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#E8622A;color:#ffffff;padding:12px 24px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600;font-family:'Libre Franklin',Helvetica,Arial,sans-serif">Accept invitation</a>
      <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#7a6a5a">If you weren't expecting this invitation, you can safely ignore this email.</p>
    </td></tr>
    <tr><td bgcolor="#1B2A3E" align="center" style="padding:16px 32px;font-family:'Libre Franklin',Helvetica,Arial,sans-serif;font-size:12px">
      <a href="https://thelitlyapp.com" style="color:#F2E8D5;opacity:0.7;text-decoration:none">thelitlyapp.com</a>
    </td></tr>
  </table>
</td></tr></table>
```

## 6. Reauthentication (OTP code) — Subject: `Your litly verification code`

```html
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1B2A3E"><tr><td align="center" style="padding:0">
  <table width="520" cellpadding="0" cellspacing="0" border="0" bgcolor="#F2E8D5" style="max-width:520px;width:100%">
    <tr><td bgcolor="#1B2A3E" align="center" style="padding:24px 32px">
      <img src="https://thelitlyapp.com/logo.png" alt="litly" width="80" height="80" style="display:block;border:0" />
    </td></tr>
    <tr><td bgcolor="#F2E8D5" style="padding:32px;font-family:'Libre Franklin',Helvetica,Arial,sans-serif;color:#1B2A3E">
      <h1 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',Times,serif;font-size:22px;color:#1B2A3E">Your verification code</h1>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#5a4a3a">Enter this code to confirm it's you:</p>
      <p style="margin:0 0 24px;font-size:32px;font-weight:700;letter-spacing:6px;color:#E8622A;font-family:'Libre Franklin',Helvetica,Arial,sans-serif">{{ .Token }}</p>
      <p style="margin:0;font-size:12px;line-height:1.6;color:#7a6a5a">If you didn't request this code, you can safely ignore this email.</p>
    </td></tr>
    <tr><td bgcolor="#1B2A3E" align="center" style="padding:16px 32px;font-family:'Libre Franklin',Helvetica,Arial,sans-serif;font-size:12px">
      <a href="https://thelitlyapp.com" style="color:#F2E8D5;opacity:0.7;text-decoration:none">thelitlyapp.com</a>
    </td></tr>
  </table>
</td></tr></table>
```

## 7. Email address changed (Security notification) — Subject: `Your litly email address was changed`

Security → "Email address changed". A notification only (no action button), sent to the old
address when the account email changes.

```html
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1B2A3E"><tr><td align="center" style="padding:0">
  <table width="520" cellpadding="0" cellspacing="0" border="0" bgcolor="#F2E8D5" style="max-width:520px;width:100%">
    <tr><td bgcolor="#1B2A3E" align="center" style="padding:24px 32px">
      <img src="https://thelitlyapp.com/logo.png" alt="litly" width="80" height="80" style="display:block;border:0" />
    </td></tr>
    <tr><td bgcolor="#F2E8D5" style="padding:32px;font-family:'Libre Franklin',Helvetica,Arial,sans-serif;color:#1B2A3E">
      <h1 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',Times,serif;font-size:22px;color:#1B2A3E">Your email address was changed</h1>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#5a4a3a">The email address on your litly account was changed from <strong>{{ .Email }}</strong> to <strong>{{ .NewEmail }}</strong>.</p>
      <p style="margin:0;font-size:12px;line-height:1.6;color:#7a6a5a">If you made this change, no action is needed. If you didn't, contact us right away at <a href="mailto:support@thelitlyapp.com" style="color:#E8622A;text-decoration:none">support@thelitlyapp.com</a>.</p>
    </td></tr>
    <tr><td bgcolor="#1B2A3E" align="center" style="padding:16px 32px;font-family:'Libre Franklin',Helvetica,Arial,sans-serif;font-size:12px">
      <a href="https://thelitlyapp.com" style="color:#F2E8D5;opacity:0.7;text-decoration:none">thelitlyapp.com</a>
    </td></tr>
  </table>
</td></tr></table>
```

## 8. Password changed (Security notification) — Subject: `Your litly password was changed`

Security → "Password changed". A notification only (no action button), sent after the account
password is updated.

```html
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1B2A3E"><tr><td align="center" style="padding:0">
  <table width="520" cellpadding="0" cellspacing="0" border="0" bgcolor="#F2E8D5" style="max-width:520px;width:100%">
    <tr><td bgcolor="#1B2A3E" align="center" style="padding:24px 32px">
      <img src="https://thelitlyapp.com/logo.png" alt="litly" width="80" height="80" style="display:block;border:0" />
    </td></tr>
    <tr><td bgcolor="#F2E8D5" style="padding:32px;font-family:'Libre Franklin',Helvetica,Arial,sans-serif;color:#1B2A3E">
      <h1 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',Times,serif;font-size:22px;color:#1B2A3E">Your password was changed</h1>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#5a4a3a">The password for your litly account (<strong>{{ .Email }}</strong>) was just changed.</p>
      <p style="margin:0;font-size:12px;line-height:1.6;color:#7a6a5a">If you made this change, no action is needed. If you didn't, reset your password immediately and contact us at <a href="mailto:support@thelitlyapp.com" style="color:#E8622A;text-decoration:none">support@thelitlyapp.com</a>.</p>
    </td></tr>
    <tr><td bgcolor="#1B2A3E" align="center" style="padding:16px 32px;font-family:'Libre Franklin',Helvetica,Arial,sans-serif;font-size:12px">
      <a href="https://thelitlyapp.com" style="color:#F2E8D5;opacity:0.7;text-decoration:none">thelitlyapp.com</a>
    </td></tr>
  </table>
</td></tr></table>
```
