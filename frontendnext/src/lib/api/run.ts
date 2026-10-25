// Runs an API call and reports the outcome as a toast, so stores and
// components don't each need their own try/catch + toast.
//   const ok = await run(() => employeesService.remove(id), { success: "Employee removed" });
import { toast } from "sonner";
import { errorMessage } from "./client";

interface RunOptions<T> {
  success?: string | ((result: T) => string | undefined);
  // Fallback when the error has no message of its own
  error?: string;
  // Don't toast failures (the caller handles them)
  silent?: boolean;
}

export async function run<T>(fn: () => Promise<T>, { success, error, silent }: RunOptions<T> = {}): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const data = await fn();
    const text = typeof success === "function" ? success(data) : success;
    if (text) toast.success(text);
    return { ok: true, data };
  } catch (err) {
    const message = errorMessage(err, error);
    if (!silent) toast.error(message);
    return { ok: false, message };
  }
}
