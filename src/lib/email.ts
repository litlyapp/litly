/**
 * Where litly's own app/site-generated mail is delivered — inbound-mail
 * forwards (contact/support/privacy + confirmations), support-form
 * submissions, and claim-your-page requests.
 *
 * This is the business inbox, intentionally separate from the owner's personal
 * email (used for account logins like Supabase/Vercel, and for health-check
 * downtime alerts, which the owner monitors more closely there).
 */
export const LITLY_INBOX = "thelitlyapp@gmail.com";
