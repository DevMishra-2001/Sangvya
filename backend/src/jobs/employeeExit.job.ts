// Moves employees serving notice to "exited" once their last working day has passed (login blocked, no longer billed).
import { completeDueExits } from "../modules/employees/employeeExit.service.js";
import { trackJob } from "./trackJob.js";

const RUN_EVERY_MS = 60 * 60 * 1000;

export function startEmployeeExitJob() {
  const run = () => trackJob("Employee exits", completeDueExits, (n) => (n ? `${n} exit${n === 1 ? "" : "s"} completed` : null));
  const firstRun = setTimeout(run, 15 * 1000);
  const interval = setInterval(run, RUN_EVERY_MS);
  return () => {
    clearTimeout(firstRun);
    clearInterval(interval);
  };
}
