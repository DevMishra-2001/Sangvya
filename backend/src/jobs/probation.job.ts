// Reminds HR and managers a week before a probation ends (checked every few hours, sent once per end date)
import { remindDueProbations } from "../modules/probation/probation.service.js";

const RUN_EVERY_MS = 6 * 60 * 60 * 1000;

export function startProbationReminderJob() {
  const run = () =>
    remindDueProbations()
      .then((n) => n && console.log(`Probation reminders sent: ${n}`))
      .catch((err) => console.error("Probation reminder job failed:", (err as Error).message));
  const firstRun = setTimeout(run, 30 * 1000);
  const interval = setInterval(run, RUN_EVERY_MS);
  return () => {
    clearTimeout(firstRun);
    clearInterval(interval);
  };
}
