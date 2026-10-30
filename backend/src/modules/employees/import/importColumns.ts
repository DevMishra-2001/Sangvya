// Columns of the employee import file, in template order
export interface ImportColumn {
  key: ImportKey;
  header: string;
  aliases?: string[];
  hint: string;
  example: string;
  width: number;
  text?: boolean; // keep as text in Excel (leading zeros, long numbers)
  date?: boolean;
}

export type ImportKey =
  | "code"
  | "name"
  | "email"
  | "phone"
  | "gender"
  | "dob"
  | "joinDate"
  | "designation"
  | "department"
  | "shift"
  | "role"
  | "manager"
  | "type"
  | "salary"
  | "address"
  | "emergencyName"
  | "emergencyPhone"
  | "password";

export const IMPORT_COLUMNS: ImportColumn[] = [
  { key: "code", header: "Employee code", aliases: ["code", "emp code", "employee id", "emp id"], hint: "Unique in your company", example: "EMP001", width: 16, text: true },
  { key: "name", header: "Name", aliases: ["full name", "employee name"], hint: "Required", example: "Priya Sharma", width: 24 },
  { key: "email", header: "Email", aliases: ["email address", "email id", "mail"], hint: "Needed for a login", example: "priya@company.com", width: 28 },
  { key: "phone", header: "Phone", aliases: ["mobile", "mobile number", "phone number", "contact number"], hint: "", example: "9876543210", width: 15, text: true },
  { key: "gender", header: "Gender", hint: "Male / Female / Other", example: "Female", width: 10 },
  { key: "dob", header: "Date of birth", aliases: ["dob", "birth date"], hint: "DD/MM/YYYY or YYYY-MM-DD", example: "14/08/1994", width: 14, date: true },
  { key: "joinDate", header: "Join date", aliases: ["joining date", "date of joining", "doj"], hint: "DD/MM/YYYY or YYYY-MM-DD", example: "01/04/2024", width: 14, date: true },
  { key: "designation", header: "Designation", aliases: ["job title", "title"], hint: "New names are added to your list", example: "Software Engineer", width: 22 },
  { key: "department", header: "Department", aliases: ["dept"], hint: "New names are added to your list", example: "Engineering", width: 18 },
  { key: "shift", header: "Shift", hint: "One of your shifts; empty = default", example: "", width: 16 },
  { key: "role", header: "Role", aliases: ["access role", "system role"], hint: "Empty = Employee", example: "Employee", width: 14 },
  { key: "manager", header: "Reports to", aliases: ["manager", "reporting manager", "manager code", "manager email"], hint: "Manager's employee code or email", example: "EMP000", width: 18 },
  { key: "type", header: "Employment type", aliases: ["type", "employee type"], hint: "Full time / Part time / Contract / Intern", example: "Full time", width: 16 },
  { key: "salary", header: "Monthly salary", aliases: ["salary", "monthly gross", "gross salary"], hint: "In ₹, numbers only", example: "45000", width: 15 },
  { key: "address", header: "Address", hint: "", example: "12 MG Road, Pune", width: 30 },
  { key: "emergencyName", header: "Emergency contact name", aliases: ["emergency contact"], hint: "", example: "Rahul Sharma", width: 22 },
  { key: "emergencyPhone", header: "Emergency contact phone", aliases: ["emergency phone"], hint: "", example: "9123456780", width: 18, text: true },
  { key: "password", header: "Temporary password", aliases: ["password"], hint: "Creates a login; changed at first login", example: "Welcome@123", width: 20, text: true },
];

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Header text → column key (header, aliases, case/space/punctuation-insensitive)
const LOOKUP = new Map<string, ImportKey>();
for (const c of IMPORT_COLUMNS) for (const h of [c.header, ...(c.aliases ?? [])]) LOOKUP.set(norm(h), c.key);
export const columnFor = (header: string) => LOOKUP.get(norm(header));
