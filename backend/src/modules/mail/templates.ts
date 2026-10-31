// Every email the app sends, in one place.
import { appUrl, render, type EmailContent } from "./layout.js";

const LEAVE_LABELS: Record<string, string> = {
  leave: "Leave",
  cl: "Casual leave",
  sl: "Sick leave",
  ol: "Optional leave",
  el: "Earned leave",
  comp_off: "Comp off",
};
export const leaveLabel = (t: string) => LEAVE_LABELS[t] ?? "Leave";

const day = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

export const leaveDates = (
  from: string,
  to: string,
  halfDay?: string | null,
) =>
  halfDay
    ? `${day(from)} (${halfDay} half)`
    : from === to
      ? day(from)
      : `${day(from)} – ${day(to)}`;

function define<P>(build: (p: P) => EmailContent, sample: NoInfer<P>) {
  return { build, sample };
}

export const TEMPLATES = {
  // ---- Accounts ----
  adminInvitation: define(
    (p: {
      name: string;
      companyName?: string | null;
      link: string;
      expiresAt: Date;
    }) => ({
      subject: "You're invited to set up your company on Workkind",
      heading: `Welcome, ${p.name.split(" ")[0]}!`,
      paragraphs: [
        `You've been invited to set up ${p.companyName ? `${p.companyName} ` : "your company "}on Workkind.`,
        "Set your password to get started.",
      ],
      button: { label: "Set my password", url: p.link },
      footnote: `The link works once and expires on ${p.expiresAt.toUTCString()}. If you weren't expecting this, ignore this email.`,
    }),
    {
      name: "Asha Rao",
      companyName: "Acme Pvt Ltd",
      link: appUrl("/activate?token=sample"),
      expiresAt: new Date(Date.now() + 48 * 3600e3),
    },
  ),

  passwordResetOtp: define(
    (p: { name: string; otp: string; minutes: number }) => ({
      subject: "Your Workkind password reset code",
      heading: "Reset your password",
      paragraphs: [`Hi ${p.name}, use this code to reset your password:`],
      details: [["Code", p.otp]],
      footnote: `It expires in ${p.minutes} minutes. If you didn't ask for this, you can ignore this email — your password stays the same.`,
    }),
    { name: "Asha", otp: "482913", minutes: 5 },
  ),

  // ---- Leave ----
  leaveRequested: define(
    (p: {
      approverName: string;
      employeeName: string;
      leaveType: string;
      from: string;
      to: string;
      halfDay?: string | null;
      days: number;
      reason?: string | null;
    }) => ({
      subject: `Leave request from ${p.employeeName}: ${leaveLabel(p.leaveType)}, ${leaveDates(p.from, p.to, p.halfDay)}`,
      heading: `${p.employeeName} asked for leave`,
      paragraphs: [
        `Hi ${p.approverName}, a leave request is waiting for your decision.`,
      ],
      details: [
        ["Type", leaveLabel(p.leaveType)],
        ["Dates", leaveDates(p.from, p.to, p.halfDay)],
        ["Days", String(p.days)],
        ...(p.reason ? [["Reason", p.reason] as [string, string]] : []),
      ],
      button: { label: "Review the request", url: appUrl("/leave") },
    }),
    {
      approverName: "Mira",
      employeeName: "Esha Patel",
      leaveType: "cl",
      from: "2026-11-06",
      to: "2026-11-09",
      days: 2,
      reason: "Family function",
    },
  ),

  leaveDecided: define(
    (p: {
      name: string;
      status: "approved" | "rejected";
      by: string;
      leaveType: string;
      from: string;
      to: string;
      halfDay?: string | null;
      note?: string | null;
    }) => ({
      subject: `Your leave on ${leaveDates(p.from, p.to, p.halfDay)} was ${p.status}`,
      heading:
        p.status === "approved"
          ? "Your leave is approved ✅"
          : "Your leave was rejected",
      paragraphs: [
        `Hi ${p.name}, ${p.by} ${p.status} your ${leaveLabel(p.leaveType).toLowerCase()} on ${leaveDates(p.from, p.to, p.halfDay)}.`,
      ],
      details: p.note ? [["Note", p.note]] : undefined,
      button: { label: "Open Leave", url: appUrl("/leave") },
    }),
    {
      name: "Esha",
      status: "approved",
      by: "Mira",
      leaveType: "cl",
      from: "2026-11-06",
      to: "2026-11-09",
      note: "Enjoy!",
    },
  ),

  leaveCancelled: define(
    (p: {
      approverName: string;
      employeeName: string;
      by: string;
      leaveType: string;
      from: string;
      to: string;
      halfDay?: string | null;
    }) => ({
      subject: `Leave cancelled: ${p.employeeName}, ${leaveDates(p.from, p.to, p.halfDay)}`,
      heading: "An approved leave was cancelled",
      paragraphs: [
        `Hi ${p.approverName}, ${p.employeeName}'s ${leaveLabel(p.leaveType).toLowerCase()} on ${leaveDates(p.from, p.to, p.halfDay)} was cancelled by ${p.by}. They'll be working those days.`,
      ],
      button: { label: "Open Leave", url: appUrl("/leave") },
    }),
    {
      approverName: "Mira",
      employeeName: "Esha Patel",
      by: "Esha Patel",
      leaveType: "cl",
      from: "2026-11-06",
      to: "2026-11-09",
    },
  ),

  // ---- Attendance ----
  attendanceAlert: define(
    (p: {
      name: string;
      employeeName: string;
      date: string;
      issues: string[];
      punchIn: string;
      punchOut: string;
      breaks: string;
      total: string;
      forEmployee: boolean;
    }) => ({
      subject: p.forEmployee
        ? `Your attendance on ${day(p.date)} needs attention`
        : `Attendance alert: ${p.employeeName} — ${day(p.date)}`,
      heading: p.forEmployee
        ? "Your day needs attention"
        : `${p.employeeName}'s attendance needs attention`,
      paragraphs: [
        `Hi ${p.name}, ${p.forEmployee ? "your" : `${p.employeeName}'s`} attendance on ${day(p.date)}:`,
        ...p.issues.map((i) => `• ${i}`),
        ...(p.forEmployee
          ? [
              "If something's wrong, ask for a correction — your manager approves it.",
            ]
          : []),
      ],
      details: [
        ["First check-in", p.punchIn],
        ["Last check-out", p.punchOut],
        ["Breaks", p.breaks],
        ["Total", p.total],
      ],
      button: p.forEmployee
        ? {
            label: "Ask for a correction",
            url: appUrl("/my-attendance/corrections"),
          }
        : { label: "Open My Team", url: appUrl("/my-team") },
    }),
    {
      name: "Mira",
      employeeName: "Esha Patel",
      date: "2026-10-29",
      issues: [
        "Total time 6h 10m is less than the required 9h 00m (General shift)",
      ],
      punchIn: "09:42",
      punchOut: "15:52",
      breaks: "0h 20m (1)",
      total: "6h 10m",
      forEmployee: false,
    },
  ),

  correctionRequested: define(
    (p: {
      approverName: string;
      employeeName: string;
      date: string;
      punchIn: string;
      punchOut: string;
      reason: string;
    }) => ({
      subject: `Attendance correction from ${p.employeeName}: ${day(p.date)}`,
      heading: `${p.employeeName} asked to correct a day`,
      paragraphs: [
        `Hi ${p.approverName}, an attendance correction is waiting for your decision.`,
      ],
      details: [
        ["Day", day(p.date)],
        ["Check-in", p.punchIn],
        ["Check-out", p.punchOut],
        ["Reason", p.reason],
      ],
      button: {
        label: "Review the correction",
        url: appUrl("/my-attendance/corrections"),
      },
    }),
    {
      approverName: "Mira",
      employeeName: "Esha Patel",
      date: "2026-10-29",
      punchIn: "09:20",
      punchOut: "18:30",
      reason: "Phone died, couldn't check in",
    },
  ),

  correctionDecided: define(
    (p: {
      name: string;
      status: "approved" | "rejected";
      by: string;
      date: string;
      note?: string | null;
    }) => ({
      subject: `Your attendance correction for ${day(p.date)} was ${p.status}`,
      heading:
        p.status === "approved"
          ? "Correction approved ✅"
          : "Correction rejected",
      paragraphs: [
        `Hi ${p.name}, ${p.by} ${p.status} your correction for ${day(p.date)}.${p.status === "approved" ? " The day now shows the corrected times." : ""}`,
      ],
      details: p.note ? [["Note", p.note]] : undefined,
      button: {
        label: "Open Corrections",
        url: appUrl("/my-attendance/corrections"),
      },
    }),
    {
      name: "Esha",
      status: "approved",
      by: "Mira",
      date: "2026-10-29",
      note: "OK",
    },
  ),

  // ---- Tickets ----
  taskAssigned: define(
    (p: {
      name: string;
      by: string;
      title: string;
      priority: string;
      due?: string | null;
      description?: string | null;
    }) => ({
      subject: `New ticket from ${p.by}: ${p.title}`,
      heading: "A ticket was assigned to you",
      paragraphs: [`Hi ${p.name}, ${p.by} assigned you a ticket.`],
      details: [
        ["Ticket", p.title],
        ["Priority", p.priority],
        ...(p.due ? [["Due", day(p.due)] as [string, string]] : []),
        ...(p.description
          ? [["Details", p.description] as [string, string]]
          : []),
      ],
      button: { label: "Open Tickets", url: appUrl("/tickets") },
    }),
    {
      name: "Esha",
      by: "Mira",
      title: "Fix the payslip PDF footer",
      priority: "high",
      due: "2026-11-05",
      description: "The company address is cut off.",
    },
  ),

  taskUpdate: define(
    (p: { name: string; title: string; message: string }) => ({
      subject: `Ticket update: ${p.title}`,
      heading: p.title,
      paragraphs: [`Hi ${p.name}, ${p.message}`],
      button: { label: "Open Tickets", url: appUrl("/tickets") },
    }),
    {
      name: "Mira",
      title: "Fix the payslip PDF footer",
      message: "Esha marked it done — review and approve it.",
    },
  ),

  // ---- Payroll ----
  payslipReady: define(
    (p: { name: string; period: string; netPay: number }) => ({
      subject: `Your payslip for ${p.period} is ready`,
      heading: `Payslip for ${p.period}`,
      paragraphs: [`Hi ${p.name}, your payslip for ${p.period} is ready to view and download.`],
      details: [["Net pay", `₹${p.netPay.toLocaleString("en-IN")}`]],
      button: { label: "View my payslips", url: appUrl("/my-payslips") },
    }),
    { name: "Esha", period: "October 2026", netPay: 48250 },
  ),

  // ---- Company (Super Admin decisions) ----
  companyReview: define(
    (p: {
      name: string;
      companyName: string;
      headline: string;
      message: string;
      note?: string | null;
    }) => ({
      subject: `${p.companyName}: ${p.headline}`,
      heading: p.headline,
      paragraphs: [`Hi ${p.name}, ${p.message}`],
      details: p.note ? [["Note from Workkind", p.note]] : undefined,
      button: { label: "Open Workkind", url: appUrl("/") },
    }),
    {
      name: "Asha",
      companyName: "Acme Pvt Ltd",
      headline: "Your company is verified",
      message: "Workkind has verified Acme Pvt Ltd's details.",
    },
  ),

  // ---- Generic (any in-app notification sent as email too) ----
  notification: define(
    (p: {
      name: string;
      title: string;
      body: string;
      link?: string | null;
    }) => ({
      subject: p.title,
      heading: p.title,
      paragraphs: [`Hi ${p.name},`, p.body],
      button: p.link
        ? { label: "Open in Workkind", url: appUrl(p.link) }
        : undefined,
    }),
    {
      name: "Esha",
      title: "New announcement: Diwali party",
      body: "Join us on Friday at 5 PM in the cafeteria.",
      link: "/",
    },
  ),

  // ---- Employee self-onboarding ----
  onboardingLink: define(
    (p: { name: string; companyName: string; link: string; expiresAt: Date }) => ({
      subject: `Complete your joining details for ${p.companyName}`,
      heading: `Welcome to ${p.companyName}, ${p.name.split(" ")[0]}!`,
      paragraphs: ["Please fill in your personal, address, bank and ID details and upload your documents (PAN, Aadhaar, education, previous employment)."],
      button: { label: "Fill my details", url: p.link },
      footnote: `The link expires on ${p.expiresAt.toUTCString()}. Don't share it — anyone with it can see and edit your joining form.`,
    }),
    { name: "Priya Sharma", companyName: "Acme Pvt Ltd", link: appUrl("/join/sample"), expiresAt: new Date(Date.now() + 24 * 3600e3) },
  ),
};

export type TemplateName = keyof typeof TEMPLATES;
export type TemplateProps<N extends TemplateName> = Parameters<
  (typeof TEMPLATES)[N]["build"]
>[0];

export function renderTemplate<N extends TemplateName>(
  name: N,
  props: TemplateProps<N>,
) {
  const t = TEMPLATES[name] as { build: (p: TemplateProps<N>) => EmailContent };
  return render(t.build(props));
}
