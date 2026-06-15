# Supabase Auth Email Templates (litly-branded)

These are the HTML templates for Supabase **Authentication → Emails** (auth emails are
sent by Supabase, NOT by `src/lib/sendEmail.ts` — that file only handles transactional
mail like RSVPs, support replies, invites, and batch sends).

**Styling:** navy `#1B2A3E`, cream `#F2E8D5`, orange `#E8622A`, logo from
`https://thelitlyapp.com/logo.png`, font stack `'Libre Franklin',Helvetica,Arial,sans-serif`.

**Email font caveat:** Gmail/Outlook strip web fonts, so most recipients see Helvetica/Arial.
That's intentional — a clean sans that matches the site as closely as email allows.

**Variables:** keep `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .Email }}`, `{{ .NewEmail }}`
exactly as written; Supabase fills them in.

---

## 1. Confirm signup — Subject: `Confirm your litly account`

```html
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1B2A3E"><tr><td align="center" style="padding:0">
  <table width="520" cellpadding="0" cellspacing="0" border="0" bgcolor="#F2E8D5" style="max-width:520px;width:100%">
    <tr><td bgcolor="#1B2A3E" align="center" style="padding:24px 32px">
      <img src="https://thelitlyapp.com/logo.png" alt="litly" width="80" height="80" style="display:block;border:0" />
    </td></tr>
    <tr><td bgcolor="#F2E8D5" style="padding:32px;font-family:'Libre Franklin',Helvetica,Arial,sans-serif;color:#1B2A3E">
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#1B2A3E">Welcome to litly</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6">Thanks for signing up. Click the button below to confirm your email address and finish creating your account.</p>
      <table cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#E8622A" style="border-radius:8px">
        <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 28px;font-family:'Libre Franklin',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">Confirm email address</a>
      </td></tr></table>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#1B2A3E;opacity:0.7">If you didn't create a litly account, you can safely ignore this email.</p>
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
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#1B2A3E">Reset your password</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6">We received a request to reset your litly password. Click the button below to choose a new one.</p>
      <table cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#E8622A" style="border-radius:8px">
        <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 28px;font-family:'Libre Franklin',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">Reset password</a>
      </td></tr></table>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#1B2A3E;opacity:0.7">If you didn't request this, you can safely ignore this email — your password won't change.</p>
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
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#1B2A3E">Log in to litly</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6">Click the button below to securely log in to your litly account. This link will expire shortly.</p>
      <table cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#E8622A" style="border-radius:8px">
        <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 28px;font-family:'Libre Franklin',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">Log in to litly</a>
      </td></tr></table>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#1B2A3E;opacity:0.7">If you didn't request this link, you can safely ignore this email.</p>
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
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#1B2A3E">Confirm your new email</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6">You requested to change your litly email from <strong>{{ .Email }}</strong> to <strong>{{ .NewEmail }}</strong>. Click below to confirm the change.</p>
      <table cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#E8622A" style="border-radius:8px">
        <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 28px;font-family:'Libre Franklin',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">Confirm new email</a>
      </td></tr></table>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#1B2A3E;opacity:0.7">If you didn't request this change, you can safely ignore this email.</p>
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
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#1B2A3E">You've been invited</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6">You've been invited to join litly. Click the button below to accept the invitation and set up your account.</p>
      <table cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#E8622A" style="border-radius:8px">
        <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 28px;font-family:'Libre Franklin',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">Accept invitation</a>
      </td></tr></table>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#1B2A3E;opacity:0.7">If you weren't expecting this invitation, you can safely ignore this email.</p>
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
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#1B2A3E">Your verification code</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6">Enter this code to confirm it's you:</p>
      <p style="margin:0;font-size:32px;font-weight:700;letter-spacing:6px;color:#E8622A">{{ .Token }}</p>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#1B2A3E;opacity:0.7">If you didn't request this code, you can safely ignore this email.</p>
    </td></tr>
    <tr><td bgcolor="#1B2A3E" align="center" style="padding:16px 32px;font-family:'Libre Franklin',Helvetica,Arial,sans-serif;font-size:12px">
      <a href="https://thelitlyapp.com" style="color:#F2E8D5;opacity:0.7;text-decoration:none">thelitlyapp.com</a>
    </td></tr>
  </table>
</td></tr></table>
```
