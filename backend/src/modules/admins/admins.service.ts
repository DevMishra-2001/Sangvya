// Admin logins (company owners), managed by the Super Admin. There's no public
// signup: the Super Admin invites an Admin, they set their own password from the
// emailed activation link, then register their company (/onboarding).
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { db } from "../../config/db.js";
import { SUPERADMIN_ROLE } from "../../config/permissions.js";
import { companies, companyMembers, employees, roles, users } from "../../db/schema.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../utils/httpErrors.js";
import { findUserByEmail, insertUser } from "../users/users.service.js";
import { createInvitation, devLink, latestInvitation, sendAdminInvitation } from "../invitations/invitations.service.js";
import type { InviteAdminInput } from "./admins.schema.js";
import { audit } from "../../utils/audit.js";

// Logins that are Admin of a company, or that have no company yet (just created)
export async function listAdmins() {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      activated_at: users.activated_at,
      created_at: users.created_at,
      company_id: companies.id,
      company_name: companies.name,
      role: roles.key,
    })
    .from(users)
    .leftJoin(companyMembers, eq(companyMembers.user_id, users.id))
    .leftJoin(companies, eq(companies.id, companyMembers.company_id))
    .leftJoin(employees, eq(employees.id, companyMembers.employee_id))
    .leftJoin(roles, eq(roles.id, employees.role_id))
    .where(ne(users.role, SUPERADMIN_ROLE))
    .orderBy(asc(users.created_at));

  type Entry = { id: number; name: string; email: string; created_at: Date | null; activated_at: Date | null; companies: { id: number; name: string }[]; isAdmin: boolean };
  const byUser = new Map<number, Entry>();
  for (const r of rows) {
    const entry = byUser.get(r.id) ?? { id: r.id, name: r.name, email: r.email, created_at: r.created_at, activated_at: r.activated_at, companies: [], isAdmin: false };
    if (r.company_id && r.role === "admin") {
      entry.companies.push({ id: r.company_id, name: r.company_name! });
      entry.isAdmin = true;
    }
    if (!r.company_id) entry.isAdmin = true; // no company yet = an Admin who hasn't set it up
    byUser.set(r.id, entry);
  }

  const admins = [];
  for (const { isAdmin, ...u } of byUser.values()) {
    if (!isAdmin) continue;
    const invite = u.activated_at ? undefined : await latestInvitation(u.id);
    // invited → activated (setting up company) → active
    const status = u.companies.length ? "active" : u.activated_at ? "setup" : invite && !invite.revoked_at && invite.expires_at > new Date() ? "invited" : "expired";
    admins.push({ ...u, status, invite_expires_at: invite?.expires_at ?? null });
  }
  return { admins };
}

// Creates the login (no password yet) and emails the activation link
export async function inviteAdmin(input: InviteAdminInput, actor: Express.AuthUser) {
  const invitedBy = actor.id;
  if (await findUserByEmail(input.email)) throw new ConflictError("An account with this email already exists");
  const user = await insertUser({ companyId: null, name: input.name, email: input.email, passwordHash: "" });
  const { token, expiresAt } = await createInvitation(user.id, { companyName: input.companyName, invitedBy });
  const link = sendAdminInvitation(user, token, input.companyName, expiresAt);
  audit(actor, { action: "admin.invited", target: ["user", user.id], summary: `Invited ${user.name} (${user.email}) as a company admin${input.companyName ? ` for ${input.companyName}` : ""}` });
  return {
    admin: { id: user.id, name: user.name, email: user.email, created_at: user.created_at, activated_at: null, companies: [], status: "invited", invite_expires_at: expiresAt },
    activationLink: devLink(link),
  };
}

// A fresh link (the old one stops working) — only before they've activated
export async function resendInvite(id: number, actor: Express.AuthUser) {
  const invitedBy = actor.id;
  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user || user.role === SUPERADMIN_ROLE) throw new NotFoundError("Admin not found");
  if (user.activated_at) throw new BadRequestError("This admin has already activated their account");
  const previous = await latestInvitation(id);
  const { token, expiresAt } = await createInvitation(id, { companyName: previous?.company_name, invitedBy });
  const link = sendAdminInvitation(user, token, previous?.company_name, expiresAt);
  audit(actor, { action: "admin.invite_resent", target: ["user", id], summary: `Sent a new activation link to ${user.email}` });
  return { invite_expires_at: expiresAt, activationLink: devLink(link) };
}

// Only while they haven't set up a company — after that, remove them from inside the company
export async function deleteAdmin(id: number, actor: Express.AuthUser) {
  const [user] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, id));
  if (!user || user.role === SUPERADMIN_ROLE) throw new NotFoundError("Admin not found");
  const [member] = await db.select({ id: companyMembers.id }).from(companyMembers).where(eq(companyMembers.user_id, id)).limit(1);
  if (member) throw new BadRequestError("This admin already has a company — they can't be removed from here");
  const [removed] = await db.delete(users).where(and(eq(users.id, id), inArray(users.role, ["member"]))).returning({ email: users.email });
  if (removed) audit(actor, { action: "admin.removed", target: ["user", id], summary: `Removed the admin login ${removed.email}` });
}
