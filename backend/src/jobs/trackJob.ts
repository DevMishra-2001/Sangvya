// Runs a background job and records it in job_runs (start, end, ok / error) for the System health page
import { eq } from "drizzle-orm";
import { db } from "../config/db.js";
import { jobRuns } from "../db/schema.js";

export async function trackJob<T>(job: string, fn: () => Promise<T>, describe?: (result: T) => string | null | undefined) {
  let runId: number | null = null;
  try {
    const [row] = await db.insert(jobRuns).values({ job }).returning({ id: jobRuns.id });
    runId = row.id;
  } catch {
    // Logging must never stop the job itself
  }
  const finish = (ok: boolean, detail: string | null) =>
    runId == null ? undefined : db.update(jobRuns).set({ finished_at: new Date(), ok, detail }).where(eq(jobRuns.id, runId)).catch(() => {});
  try {
    const result = await fn();
    await finish(true, describe?.(result) ?? null);
    return result;
  } catch (err) {
    const message = (err as Error).message;
    console.error(`${job} failed:`, message);
    await finish(false, message.slice(0, 500));
    return undefined;
  }
}
