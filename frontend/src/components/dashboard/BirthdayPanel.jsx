import { Cake } from "lucide-react";
import { useSelector } from "react-redux";

// Small dashboard box (top-right) with today's birthday wishes. The API only
// returns today's birthdays; data comes from the feed AnnouncementsPanel loads.
export default function BirthdayPanel() {
  const today = useSelector((state) => state.feed.birthdays);
  const user = useSelector((state) => state.auth.user);

  return (
    <section className="bg-card border border-line rounded-xl p-4 w-full max-w-sm flex flex-col">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-3">
        <Cake size={15} /> Birthday wishes
      </div>

      {today.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
          <div className="text-2xl opacity-40">🎂</div>
          <div className="text-xs text-slate mt-1">No birthdays today.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 overflow-y-auto max-h-[150px]">
          {today.map((b) => {
            const mine = b.employeeId === user.employee_id;
            return (
              <div key={b.employeeId} className="rounded-lg bg-goldbg px-3 py-2 flex items-center gap-2.5">
                <div className="text-xl">🎂</div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink truncate">
                    {mine ? "Happy Birthday to you! 🎉" : `Happy Birthday, ${b.name}! 🎉`}
                  </div>
                  {!mine && b.designation && <div className="text-xs text-slate truncate">{b.designation}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
