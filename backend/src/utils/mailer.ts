import nodemailer from "nodemailer";
import { env } from "../config/env.js";

// One shared SMTP transport. Without SMTP_HOST (e.g. local dev) emails are
// printed to the console instead, so the rest of the app works unchanged.
const transport = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : null;

interface Mail {
  to: string;
  subject: string;
  text: string;
}

// Never throws — a failed email must not fail the request that triggered it.
export async function sendMail({ to, subject, text }: Mail) {
  if (!transport) {
    console.log(`[mail:not-configured] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }
  try {
    await transport.sendMail({ from: env.MAIL_FROM || env.SMTP_USER, to, subject, text });
  } catch (err) {
    console.error(`Failed to send email to ${to}:`, (err as Error).message);
  }
}
