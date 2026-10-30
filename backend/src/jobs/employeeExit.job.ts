// Moves employees serving notice to "exited" once their last working day has passed (login blocked, no longer billed).
import { completeDueExits } from "../modules/employees/employeeExit.service.js";

const RUN_EVERY_MS = 60 * 60 * 1000;

export function startEmployeeExitJob() {
  const run = () =>
    completeDueExits()
      .then((n) => n && console.log(`Employee exits completed: ${n}`))
      .catch((err) => console.error("Employee exit job failed:", (err as Error).message));
  const firstRun = setTimeout(run, 15 * 1000);
  const interval = setInterval(run, RUN_EVERY_MS);
  return () => {
    clearTimeout(firstRun);
    clearInterval(interval);
  };
}
