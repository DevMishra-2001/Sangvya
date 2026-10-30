// Who approves an employee's requests (leave, attendance corrections): their reporting manager.
import type { Permission } from "../../config/permissions.js";
import { can } from "../../utils/can.js";

export interface ApprovalTarget {
  employee_id: number;
  manager_id: number | null;
  manager_status: string | null;
}

export function approverOf(t: Pick<ApprovalTarget, "manager_id" | "manager_status">): "manager" | "hr" {
  return t.manager_id && t.manager_status !== "exited" ? "manager" : "hr";
}

export function canDecideFor(user: Express.AuthUser, t: ApprovalTarget, hrPermission: Permission) {
  if (user.employeeId && t.employee_id === user.employeeId) return false;
  if (approverOf(t) === "manager") return Boolean(user.employeeId) && t.manager_id === user.employeeId;
  return can(user, hrPermission);
}
