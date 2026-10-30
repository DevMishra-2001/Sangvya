// Who hears about leave, and what they're told (bell + email)
import { leaveDates, leaveLabel } from "../mail/templates.js";
import { hrRecipients, notify, type Recipient } from "../notifications/notify.js";
import { countLeaveDays } from "./leaveBalance.service.js";

export interface LeaveFacts {
  id: number;
  company_id: number;
  employee_id: number;
  employee_name: string;
  manager_id: number | null;
  manager_status?: string | null;
  leave_type: string;
  from_date: string;
  to_date: string;
  half_day: string | null;
  reason: string | null;
}

const short = (l: LeaveFacts) => `${leaveLabel(l.leave_type)} · ${leaveDates(l.from_date, l.to_date, l.half_day)}`;

async function approvers(l: LeaveFacts): Promise<Recipient[]> {
  return l.manager_id && l.manager_status !== "exited" ? [{ employeeId: l.manager_id }] : hrRecipients(l.company_id);
}

export async function notifyLeaveRequested(l: LeaveFacts, actorId: number) {
  const days = await countLeaveDays(l.company_id, l.from_date, l.to_date, l.half_day);
  await notify({
    companyId: l.company_id,
    to: await approvers(l),
    type: "leave.requested",
    title: `${l.employee_name} asked for leave`,
    body: `${short(l)} · ${days} day${days === 1 ? "" : "s"}${l.reason ? ` — ${l.reason}` : ""}`,
    link: "/leave",
    entity: ["leave", l.id],
    actorId,
    email: (r) => ({
      template: "leaveRequested",
      props: { approverName: r.name, employeeName: l.employee_name, leaveType: l.leave_type, from: l.from_date, to: l.to_date, halfDay: l.half_day, days, reason: l.reason },
    }),
  });
}

export async function notifyLeaveDecided(l: LeaveFacts, status: "approved" | "rejected", by: { id: number; name: string }, note: string | null) {
  await notify({
    companyId: l.company_id,
    to: [{ employeeId: l.employee_id }],
    type: `leave.${status}`,
    title: `Your leave was ${status}`,
    body: `${short(l)} · by ${by.name}${note ? ` — “${note}”` : ""}`,
    link: "/leave",
    entity: ["leave", l.id],
    actorId: by.id,
    email: (r) => ({
      template: "leaveDecided",
      props: { name: r.name, status, by: by.name, leaveType: l.leave_type, from: l.from_date, to: l.to_date, halfDay: l.half_day, note },
    }),
  });
}

export async function notifyLeaveCancelled(l: LeaveFacts, wasApproved: boolean, by: { id: number; name: string; employeeId: number | null }) {
  const byEmployee = by.employeeId === l.employee_id;
  if (wasApproved) {
    await notify({
      companyId: l.company_id,
      to: await approvers(l),
      type: "leave.cancelled",
      title: `${l.employee_name}'s leave was cancelled`,
      body: `${short(l)} · by ${by.name}`,
      link: "/leave",
      entity: ["leave", l.id],
      actorId: by.id,
      email: (r) => ({
        template: "leaveCancelled",
        props: { approverName: r.name, employeeName: l.employee_name, by: by.name, leaveType: l.leave_type, from: l.from_date, to: l.to_date, halfDay: l.half_day },
      }),
    });
  }
  if (!byEmployee) {
    await notify({
      companyId: l.company_id,
      to: [{ employeeId: l.employee_id }],
      type: "leave.cancelled",
      title: "Your leave was cancelled",
      body: `${short(l)} · by ${by.name}. The days are back in your balance.`,
      link: "/leave",
      entity: ["leave", l.id],
      actorId: by.id,
      email: (r) => ({ template: "notification", props: { name: r.name, title: "Your leave was cancelled", body: `${by.name} cancelled your ${short(l)}. The days are back in your balance.`, link: "/leave" } }),
    });
  }
}
