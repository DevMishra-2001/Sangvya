// Global search for the command palette (Ctrl/⌘+K): people, tickets and candidates the user may see.
// Top 5 of each; a kind the user has no access to (or whose module is off) comes back empty.
import { and, asc, desc, eq, ilike, ne, or } from "drizzle-orm";
import { db } from "../../config/db.js";
import {
  candidates,
  designations,
  employees,
  jobPostings,
  ticketStatuses,
  tickets,
} from "../../db/schema.js";
import { can } from "../../utils/can.js";
import { assignee, visibleTo } from "../tickets/tickets.service.js";

const LIMIT = 5;

// "%text%" with LIKE wildcards in the search taken literally
const likeOf = (q: string) => `%${q.replace(/[%_\\]/g, "\\$&")}%`;

// Everyone with employees.view; otherwise only the people who report to you
function searchPeople(
  companyId: number,
  actor: Express.AuthUser,
  like: string,
) {
  const all = can(actor, "employees.view");
  if (!all && !actor.employeeId) return Promise.resolve([]);
  return db
    .select({
      id: employees.id,
      name: employees.name,
      code: employees.employee_code,
      photo_url: employees.photo_url,
      designation: designations.name,
    })
    .from(employees)
    .leftJoin(designations, eq(designations.id, employees.designation_id))
    .where(
      and(
        eq(employees.company_id, companyId),
        ne(employees.status, "exited"),
        all ? undefined : eq(employees.manager_id, actor.employeeId!),
        or(
          ilike(employees.name, like),
          ilike(employees.employee_code, like),
          ilike(employees.email, like),
        ),
      ),
    )
    .orderBy(asc(employees.name))
    .limit(LIMIT);
}

// Tickets you can see (Tickets module on): by code, number or title
function searchTickets(
  companyId: number,
  actor: Express.AuthUser,
  q: string,
  like: string,
) {
  if (!can(actor, "tasks.assign")) return Promise.resolve([]);
  return db
    .select({
      id: tickets.id,
      code: tickets.code,
      title: tickets.title,
      status_name: ticketStatuses.name,
      status_color: ticketStatuses.color,
    })
    .from(tickets)
    .innerJoin(ticketStatuses, eq(ticketStatuses.id, tickets.status_id))
    .leftJoin(assignee, eq(assignee.id, tickets.assigned_to))
    .where(
      and(
        eq(tickets.company_id, companyId),
        visibleTo(actor),
        or(
          ilike(tickets.code, like),
          ilike(tickets.title, like),
          /^\d+$/.test(q) ? eq(tickets.number, Number(q)) : undefined,
        ),
      ),
    )
    .orderBy(desc(tickets.updated_at))
    .limit(LIMIT);
}

// Candidates (Recruitment): by name, email or phone
function searchCandidates(
  companyId: number,
  actor: Express.AuthUser,
  like: string,
) {
  if (!can(actor, "recruitment.view") && !can(actor, "recruitment.candidates"))
    return Promise.resolve([]);
  return db
    .select({
      id: candidates.id,
      name: candidates.name,
      stage: candidates.stage,
      job: jobPostings.title,
    })
    .from(candidates)
    .innerJoin(jobPostings, eq(jobPostings.id, candidates.job_posting_id))
    .where(
      and(
        eq(candidates.company_id, companyId),
        or(
          ilike(candidates.name, like),
          ilike(candidates.email, like),
          ilike(candidates.phone, like),
        ),
      ),
    )
    .orderBy(desc(candidates.created_at))
    .limit(LIMIT);
}

export async function globalSearch(
  companyId: number,
  actor: Express.AuthUser,
  q: string,
) {
  const like = likeOf(q);
  const [people, ticketRows, candidateRows] = await Promise.all([
    searchPeople(companyId, actor, like),
    searchTickets(companyId, actor, q, like),
    searchCandidates(companyId, actor, like),
  ]);
  return { people, tickets: ticketRows, candidates: candidateRows };
}
