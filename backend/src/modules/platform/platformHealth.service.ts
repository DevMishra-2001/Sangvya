// Super Admin: is everything running? Background jobs, email delivery, database and the server process.
import { sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { env } from "../../config/env.js";

const rows = async <T>(q: ReturnType<typeof sql>) => (await db.execute(q)).rows as T[];
const MIN = 60 * 1000;

// Every job and how often it should run (matches src/jobs)
const JOBS = [
  { name: "Day close", everyMin: 15, what: "End-of-day attendance alerts" },
  { name: "Employee exits", everyMin: 60, what: "Moves people to exited after their last day" },
  { name: "Probation reminders", everyMin: 6 * 60, what: "Tells HR a week before probation ends" },
  { name: "Cleanup", everyMin: 24 * 60, what: "Removes old notifications and logs" },
];
const startedAt = new Date();

export async function platformHealth() {
  const [jobRows, mailDays, mailTotals, failures, [dbInfo], tables] = await Promise.all([
    rows<{ job: string; last_run: string | null; last_ok: string | null; last_error_at: string | null; last_error: string | null; runs_24h: number; failed_24h: number; last_detail: string | null }>(sql`
      select j.job,
        max(j.started_at) as last_run,
        max(j.finished_at) filter (where j.ok) as last_ok,
        max(j.finished_at) filter (where j.ok = false) as last_error_at,
        (select r.detail from job_runs r where r.job = j.job and r.ok = false order by r.id desc limit 1) as last_error,
        (select r.detail from job_runs r where r.job = j.job and r.ok order by r.id desc limit 1) as last_detail,
        count(*) filter (where j.started_at > now() - interval '24 hours')::int as runs_24h,
        count(*) filter (where j.started_at > now() - interval '24 hours' and j.ok = false)::int as failed_24h
      from job_runs j group by j.job`),
    rows<{ day: string; sent: number; failed: number; logged: number }>(sql`
      with d as (select generate_series((now() at time zone 'Asia/Kolkata')::date - 6, (now() at time zone 'Asia/Kolkata')::date, interval '1 day')::date as day)
      select to_char(d.day, 'YYYY-MM-DD') as day,
        count(m.id) filter (where m.status = 'sent')::int as sent,
        count(m.id) filter (where m.status = 'failed')::int as failed,
        count(m.id) filter (where m.status = 'logged')::int as logged
      from d left join mail_log m on (m.created_at at time zone 'Asia/Kolkata')::date = d.day
      group by d.day order by d.day`),
    rows<{ sent: number; failed: number; logged: number }>(sql`select
        count(*) filter (where status = 'sent')::int as sent,
        count(*) filter (where status = 'failed')::int as failed,
        count(*) filter (where status = 'logged')::int as logged
      from mail_log where created_at > now() - interval '7 days'`),
    rows<{ to_email: string; subject: string; error: string | null; created_at: string }>(sql`select to_email, subject, error, created_at from mail_log where status = 'failed' order by id desc limit 10`),
    rows<{ size: string; connections: number }>(sql`select pg_size_pretty(pg_database_size(current_database())) as size, (select count(*)::int from pg_stat_activity where datname = current_database()) as connections`),
    rows<{ name: string; rows: number }>(sql`select relname as name, n_live_tup::int as rows from pg_stat_user_tables order by n_live_tup desc limit 8`),
  ]);

  const byName = new Map(jobRows.map((j) => [j.job, j]));
  const now = Date.now();
  const jobs = JOBS.map((j) => {
    const r = byName.get(j.name);
    const lastRun = r?.last_run ? new Date(r.last_run).getTime() : null;
    // Late = no run for over twice its interval (or never ran while the server has been up that long)
    const late = lastRun ? now - lastRun > 2 * j.everyMin * MIN : now - startedAt.getTime() > 2 * j.everyMin * MIN;
    const failing = Boolean(r?.last_error_at && (!r.last_ok || new Date(r.last_error_at) > new Date(r.last_ok)));
    return { ...j, ...(r ?? { last_run: null, last_ok: null, last_error_at: null, last_error: null, last_detail: null, runs_24h: 0, failed_24h: 0 }), state: failing ? "failing" : late ? "late" : lastRun ? "ok" : "waiting" };
  });

  const mem = process.memoryUsage();
  return {
    jobs,
    mail: {
      smtpConfigured: Boolean(env.SMTP_HOST),
      redirectedTo: env.MAIL_REDIRECT_TO ? "on" : null, // staging safety switch (address not shown)
      last7Days: mailTotals[0] ?? { sent: 0, failed: 0, logged: 0 },
      daily: mailDays,
      failures,
    },
    database: { size: dbInfo?.size ?? "—", connections: dbInfo?.connections ?? 0, biggestTables: tables },
    server: {
      environment: env.NODE_ENV,
      node: process.version,
      startedAt: startedAt.toISOString(),
      uptimeMin: Math.round(process.uptime() / 60),
      memoryMb: Math.round(mem.rss / 1024 / 1024),
      heapMb: Math.round(mem.heapUsed / 1024 / 1024),
    },
  };
}
