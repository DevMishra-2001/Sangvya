// Super Admin: revenue (MRR, conversions, payments) and usage (logins, check-ins, modules, at-risk companies)
import { sql } from "drizzle-orm";
import { db } from "../../config/db.js";

const rows = async <T>(q: ReturnType<typeof sql>) => (await db.execute(q)).rows as T[];
const MONTHS = 12;
const DAYS = 30;

export async function platformInsights() {
  const [subs] = await rows<{ mrr: string; paying: number; trial: number; past_due: number; cancelled: number; trials_ended: number; converted: number }>(sql`select
      coalesce(sum(case when status = 'active' then quantity * price_per_employee end), 0)::text as mrr,
      count(*) filter (where status = 'active')::int as paying,
      count(*) filter (where status = 'trial')::int as trial,
      count(*) filter (where status = 'past_due')::int as past_due,
      count(*) filter (where status = 'cancelled')::int as cancelled,
      count(*) filter (where trial_ends_at < now() or status <> 'trial')::int as trials_ended,
      count(*) filter (where status in ('active', 'past_due'))::int as converted
    from subscriptions`);

  // Last 12 months: new companies and money collected
  const monthly = await rows<{ month: string; companies: number; revenue: string; payments: number }>(sql`
    with m as (select to_char(d, 'YYYY-MM') as month from generate_series(date_trunc('month', now()) - interval '${sql.raw(String(MONTHS - 1))} months', date_trunc('month', now()), interval '1 month') d)
    select m.month,
      (select count(*)::int from companies c where to_char(c.created_at, 'YYYY-MM') = m.month) as companies,
      (select coalesce(sum(i.amount), 0)::text from invoices i where i.status = 'paid' and to_char(i.created_at, 'YYYY-MM') = m.month) as revenue,
      (select count(*)::int from invoices i where i.status = 'paid' and to_char(i.created_at, 'YYYY-MM') = m.month) as payments
    from m order by m.month`);

  // Last 30 days, per day: logins and check-ins across the platform
  const daily = await rows<{ day: string; logins: number; active_users: number; checkins: number }>(sql`
    with d as (select generate_series((now() at time zone 'Asia/Kolkata')::date - ${sql.raw(String(DAYS - 1))}, (now() at time zone 'Asia/Kolkata')::date, interval '1 day')::date as day)
    select to_char(d.day, 'YYYY-MM-DD') as day,
      (select count(*)::int from user_sessions s where (s.created_at at time zone 'Asia/Kolkata')::date = d.day) as logins,
      (select count(distinct s.user_id)::int from user_sessions s where (s.created_at at time zone 'Asia/Kolkata')::date = d.day) as active_users,
      (select count(*)::int from attendance a where a.date = d.day and a.punch_in is not null) as checkins
    from d order by d.day`);

  // What people use, last 30 days
  const [modules] = await rows<Record<string, number>>(sql`select
      (select count(*)::int from attendance where punch_in > now() - interval '30 days') as attendance,
      (select count(*)::int from leave_requests where created_at > now() - interval '30 days') as leave,
      (select count(*)::int from payslips where created_at > now() - interval '30 days') as payroll,
      (select count(*)::int from candidates where created_at > now() - interval '30 days') as recruitment,
      (select count(*)::int from performance_reviews where created_at > now() - interval '30 days') as performance,
      (select count(*)::int from tasks where created_at > now() - interval '30 days') as tasks,
      (select count(*)::int from asset_assignments where created_at > now() - interval '30 days') as assets`);

  const companyRows = await rows<{ id: number; name: string; status: string; employees: number; active_users_7d: number; last_active_at: string | null; subscription_status: string | null; trial_ends_at: string | null; mrr: string }>(sql`
    select c.id, c.name, c.status,
      (select count(*)::int from employees e where e.company_id = c.id) as employees,
      (select count(distinct s.user_id)::int from user_sessions s join company_members m on m.user_id = s.user_id where m.company_id = c.id and s.last_activity_at > now() - interval '7 days') as active_users_7d,
      (select max(s.last_activity_at) from user_sessions s join company_members m on m.user_id = s.user_id where m.company_id = c.id) as last_active_at,
      sub.status as subscription_status, sub.trial_ends_at,
      (case when sub.status = 'active' then sub.quantity * sub.price_per_employee else 0 end)::text as mrr
    from companies c left join subscriptions sub on sub.company_id = c.id`);

  const now = Date.now();
  const day = 86400000;
  const mrr = Number(subs.mrr);
  return {
    revenue: {
      mrr,
      arr: mrr * 12,
      paying: subs.paying,
      trial: subs.trial,
      pastDue: subs.past_due,
      cancelled: subs.cancelled,
      // Of the trials that are over, how many became paying customers
      conversionRate: subs.trials_ended ? Math.round((subs.converted / subs.trials_ended) * 100) : null,
      avgPerCompany: subs.paying ? Math.round(mrr / subs.paying) : 0,
    },
    monthly: monthly.map((m) => ({ ...m, revenue: Number(m.revenue) })),
    daily,
    modules,
    trialsEnding: companyRows
      .filter((c) => c.subscription_status === "trial" && c.trial_ends_at && new Date(c.trial_ends_at).getTime() - now < 7 * day)
      .sort((a, b) => String(a.trial_ends_at).localeCompare(String(b.trial_ends_at))),
    pastDue: companyRows.filter((c) => c.subscription_status === "past_due"),
    // Quiet for 14+ days — likely to leave
    atRisk: companyRows
      .filter((c) => c.status === "active" && (!c.last_active_at || now - new Date(c.last_active_at).getTime() > 14 * day))
      .sort((a, b) => b.employees - a.employees)
      .slice(0, 10),
    mostActive: [...companyRows].sort((a, b) => b.active_users_7d - a.active_users_7d).filter((c) => c.active_users_7d > 0).slice(0, 10),
    topRevenue: [...companyRows].filter((c) => Number(c.mrr) > 0).sort((a, b) => Number(b.mrr) - Number(a.mrr)).slice(0, 10),
  };
}
