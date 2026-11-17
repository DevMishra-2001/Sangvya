// Moves tickets that sat in Done longer than the company's auto-close days to Closed (every few hours)
import { autoCloseTickets } from "../modules/tickets/ticketViews.service.js";
import { trackJob } from "./trackJob.js";

const RUN_EVERY_MS = 6 * 60 * 60 * 1000;

export function startTicketAutoCloseJob() {
  const run = () => trackJob("Ticket auto-close", autoCloseTickets, (n) => (n ? `${n} ticket${n === 1 ? "" : "s"} closed` : null));
  const firstRun = setTimeout(run, 60 * 1000);
  const interval = setInterval(run, RUN_EVERY_MS);
  return () => {
    clearTimeout(firstRun);
    clearInterval(interval);
  };
}
