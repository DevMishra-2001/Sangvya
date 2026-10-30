// Makes a login the platform Super Admin (sees every page, can manage the Page
// Master and roles). Their employee record in each company gets the
// Super Admin role too.
//   npm run make-superadmin -- someone@example.com
//   npm run make-superadmin -- someone@example.com --remove   (back to Admin)
import { eq, inArray, sql } from "drizzle-orm";
import { db, pool } from "../src/config/db.js";
import { companyMembers, employees, roles, users } from "../src/db/schema.js";

const [email, flag] = process.argv.slice(2);
if (!email) {
  console.error("Usage: npm run make-superadmin -- <email> [--remove]");
  process.exit(1);
}
const remove = flag === "--remove";

const [user] = await db.select().from(users).where(sql`lower(${users.email}) = lower(${email})`);
if (!user) {
  console.error(`No login with email ${email}`);
  await pool.end();
  process.exit(1);
}

const [role] = await db.select().from(roles).where(eq(roles.key, remove ? "admin" : "superadmin"));
await db.transaction(async (tx) => {
  await tx.update(users).set({ role: remove ? "member" : "superadmin" }).where(eq(users.id, user.id));
  const members = await tx.select({ employeeId: companyMembers.employee_id }).from(companyMembers).where(eq(companyMembers.user_id, user.id));
  const ids = members.map((m) => m.employeeId).filter((id): id is number => id !== null);
  if (ids.length && role) await tx.update(employees).set({ role_id: role.id }).where(inArray(employees.id, ids));
});

console.log(remove ? `${user.email} is no longer Super Admin (now Admin).` : `${user.email} is now the Super Admin.`);
await pool.end();
