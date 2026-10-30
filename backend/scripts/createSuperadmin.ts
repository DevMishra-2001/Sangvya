// Creates the platform Super Admin login on a fresh database (there's no public
// signup). They can then create Admin logins from the Admins page.
//   npm run create-superadmin -- you@example.com 'StrongPass@123' "Your Name"
// An existing login is just made Super Admin instead: npm run make-superadmin -- <email>
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db, pool } from "../src/config/db.js";
import { users } from "../src/db/schema.js";
import { strongPassword } from "../src/utils/passwordPolicy.js";

const [email, password, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(" ").trim() || "Super Admin";
if (!email || !password) {
  console.error(`Usage: npm run create-superadmin -- <email> '<password>' "<name>"`);
  process.exit(1);
}
const check = strongPassword.safeParse(password);
if (!check.success) {
  console.error(`Password: ${check.error.errors.map((e) => e.message).join(", ")}`);
  process.exit(1);
}

const [existing] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = lower(${email})`);
if (existing) {
  console.error(`${email} already has a login — use: npm run make-superadmin -- ${email}`);
  await pool.end();
  process.exit(1);
}

await db.insert(users).values({ name, email: email.toLowerCase(), password_hash: await bcrypt.hash(password, 10), role: "superadmin", activated_at: new Date() });
console.log(`Super Admin ${email} created. Log in, then create Admin logins from the Admins page.`);
await pool.end();
