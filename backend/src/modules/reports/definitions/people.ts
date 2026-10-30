import { eq, ne } from "drizzle-orm";
import { db } from "../../../config/db.js";
import { employees, roles } from "../../../db/schema.js";
import type { ReportDef } from "../types.js";
import { departmentFilter, deptId, deptName, peopleQuery, subtitle } from "./common.js";

const TYPE: Record<string, string> = { full_time: "Full time", part_time: "Part time", contract: "Contract", intern: "Intern" };
const STATUS: Record<string, string> = { active: "Active", notice: "On notice", exited: "Left" };

export const employeeMaster: ReportDef = {
  key: "employee-master",
  title: "Employee master",
  description: "Everyone's details in one sheet — contact, department, role, manager, joining and status.",
  group: "People",
  permission: "reports.people",
  filters: [
    {
      key: "status",
      label: "Status",
      type: "select",
      default: "current",
      options: [
        { value: "current", label: "Current staff" },
        { value: "active", label: "Active" },
        { value: "notice", label: "On notice" },
        { value: "exited", label: "Left" },
        { value: "all", label: "Everyone" },
      ],
    },
    departmentFilter,
  ],
  async build(companyId, filters) {
    const dept = deptId(filters);
    const status = filters.status ?? "current";
    const where = status === "current" ? ne(employees.status, "exited") : status === "all" ? undefined : eq(employees.status, status as "active");
    const [people, roleRows] = await Promise.all([peopleQuery(companyId, { departmentId: dept, where }), db.select({ id: roles.id, name: roles.name }).from(roles)]);
    const roleName = new Map(roleRows.map((r) => [r.id, r.name]));
    const rows = people.map((p) => ({
      code: p.code ?? "",
      name: p.name,
      email: p.email ?? "",
      phone: p.phone ?? "",
      department: p.department ?? "",
      designation: p.designation ?? "",
      role: p.role_id ? (roleName.get(p.role_id) ?? "") : "",
      manager: p.manager ?? "",
      type: TYPE[p.employment_type] ?? p.employment_type,
      join_date: p.join_date ?? "",
      status: STATUS[p.status] ?? p.status,
      exit_date: p.exit_date ?? "",
    }));
    const label = { current: "Current staff", all: "Everyone" }[status] ?? STATUS[status];
    return {
      title: "Employee master",
      subtitle: subtitle(label, await deptName(companyId, dept), `${rows.length} people`),
      columns: [
        { key: "code", label: "Code", width: 10 },
        { key: "name", label: "Name", width: 22 },
        { key: "email", label: "Email", width: 26, exportOnly: true },
        { key: "phone", label: "Phone", width: 15, exportOnly: true },
        { key: "department", label: "Department", width: 16 },
        { key: "designation", label: "Designation", width: 18 },
        { key: "role", label: "Role", width: 11, exportOnly: true },
        { key: "manager", label: "Reports to", width: 18, exportOnly: true },
        { key: "type", label: "Type", width: 10, exportOnly: true },
        { key: "join_date", label: "Joined", type: "date", width: 11 },
        { key: "status", label: "Status", width: 10 },
        { key: "exit_date", label: "Last day", type: "date", width: 11, exportOnly: true },
      ],
      rows,
      fileName: `employee-master-${status}`,
    };
  },
};
