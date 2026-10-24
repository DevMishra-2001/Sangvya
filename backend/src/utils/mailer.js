const nodemailer = require("nodemailer");

// One shared SMTP transport. Without SMTP_HOST (e.g. local dev) emails are
// printed to the console instead, so the rest of the app works unchanged.
const transport = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  : null;

// Never throws — a failed email must not fail the request that triggered it.
async function sendMail({ to, subject, text }) {
  if (!transport) {
    console.log(`[mail:not-configured] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }
  try {
    await transport.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text });
  } catch (err) {
    console.error(`Failed to send email to ${to}:`, err.message);
  }
}

module.exports = { sendMail };
