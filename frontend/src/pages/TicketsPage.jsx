import { useState } from "react";
import useCan from "../hooks/useCan";
import MyTickets from "../components/tasks/MyTickets";
import TeamTickets from "../components/tasks/TeamTickets";

// Everything about tickets in one place: tickets assigned to me (with my
// progress charts) and, for managers/HR/superadmin, tickets I assign to others.
export default function TicketsPage() {
  const can = useCan();
  const canAssign = can("tasks.assign");
  const [tab, setTab] = useState("mine");

  const tabClass = (key) =>
    `px-4 py-2.5 bg-transparent border-none border-b-2 text-sm cursor-pointer ${
      tab === key ? "text-ink font-semibold border-brass" : "text-slate border-transparent"
    }`;

  return (
    <div>
      <h1 className="mb-4">Tickets</h1>
      {canAssign && (
        <div className="flex gap-1 mb-5 border-b border-line">
          <button className={tabClass("mine")} onClick={() => setTab("mine")}>My tickets</button>
          <button className={tabClass("team")} onClick={() => setTab("team")}>Team tickets</button>
        </div>
      )}
      {tab === "team" && canAssign ? <TeamTickets /> : <MyTickets />}
    </div>
  );
}
