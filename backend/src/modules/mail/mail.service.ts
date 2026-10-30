// SMTP sending (env: SMTP_HOST/PORT/USER/PASS, MAIL_FROM); logs to console when SMTP_HOST is unset
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../config/env.js";
import {
  renderTemplate,
  type TemplateName,
  type TemplateProps,
} from "./templates.js";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

let transport: Transporter | null | undefined;
function getTransport() {
  if (transport !== undefined) return transport;
  transport = env.SMTP_HOST
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: env.SMTP_USER
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined,
        pool: true, // reuse connections when many emails go out at once
      })
    : null;
  return transport;
}

// Never throws — a failed email must not fail the request that triggered it.
export async function sendMail(original: Mail) {
  // Staging: real people never get mail; the intended recipient shows in the subject
  const mail = env.MAIL_REDIRECT_TO ? { ...original, to: env.MAIL_REDIRECT_TO, subject: `[to ${original.to}] ${original.subject}` } : original;
  const t = getTransport();
  if (!t) {
    console.log(
      `[mail:not-sent] To: ${mail.to}\nSubject: ${mail.subject}\n${mail.text}\n`,
    );
    return;
  }
  try {
    await t.sendMail({
      from: env.MAIL_FROM || env.SMTP_USER,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      replyTo: mail.replyTo,
    });
  } catch (err) {
    console.error(
      `Failed to send email to ${mail.to}:`,
      (err as Error).message,
    );
  }
}

// Render a template with its props and send it
export function sendTemplate<N extends TemplateName>(
  to: string | null | undefined,
  name: N,
  props: TemplateProps<N>,
) {
  if (!to) return Promise.resolve();
  const { subject, html, text } = renderTemplate(name, props);
  return sendMail({ to, subject, html, text });
}
