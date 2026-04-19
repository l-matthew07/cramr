/**
 * Resend email helper.
 * Gracefully no-ops if RESEND_API_KEY is not set.
 */
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM ?? "Cramr <no-reply@cramr.app>";

let resend: Resend | null = null;
if (apiKey) {
  resend = new Resend(apiKey);
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  if (!resend) {
    console.log(`[email] no-op (RESEND_API_KEY not set): ${payload.subject} → ${payload.to}`);
    return;
  }
  try {
    await resend.emails.send({
      from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });
  } catch (err) {
    console.error("[email] send failed", err);
    // Swallow — never crash the app for email
  }
}
