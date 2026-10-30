// Daily housekeeping: removes old notifications (read after 60 days, all after 180)
import { cleanupNotifications } from "../modules/notifications/notifications.service.js";

const RUN_EVERY_MS = 24 * 60 * 60 * 1000;

export function startNotificationCleanupJob() {
  const run = () =>
    cleanupNotifications()
      .then((n) => n && console.log(`Old notifications removed: ${n}`))
      .catch((err) => console.error("Notification cleanup failed:", (err as Error).message));
  const firstRun = setTimeout(run, 60 * 1000);
  const interval = setInterval(run, RUN_EVERY_MS);
  return () => {
    clearTimeout(firstRun);
    clearInterval(interval);
  };
}
