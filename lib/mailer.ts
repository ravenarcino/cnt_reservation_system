import nodemailer from "nodemailer";

// Generic SMTP mailer used by the password-reset flow.
// Reads SMTP_* env vars. Throws on failure so callers can decide how to handle.
export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM,
  } = process.env;

  if (!SMTP_HOST || !SMTP_FROM) {
    throw new Error("SMTP is not configured (SMTP_HOST / SMTP_FROM missing)");
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    secure: SMTP_SECURE === "true", // true for 465, false for 587/STARTTLS
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });

  return transporter.sendMail({
    from: SMTP_FROM,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
}
