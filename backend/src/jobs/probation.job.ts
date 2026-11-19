// Reminds HR and managers a week before a probation ends (checked every few hours, sent once per end date)
import { remindDueProbations } from "../modules/probation/probation.service.js";
import { trackJob } from "./trackJob.js";

const RUN_EVERY_MS = 6 * 60 * 60 * 1000;

export function startProbationReminderJob() {
  const run = () => trackJob("Probation reminders", remindDueProbations, (n) => (n ? `${n} reminder${n === 1 ? "" : "s"} sent` : null));
  const firstRun = setTimeout(run, 30 * 1000);
  const interval = setInterval(run, RUN_EVERY_MS);
  return () => {
    clearTimeout(firstRun);
    clearInterval(interval);
  };
}
