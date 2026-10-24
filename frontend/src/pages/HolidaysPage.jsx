import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { fetchHolidays, addHoliday, deleteHoliday } from "../store/slices/holidaysSlice";

// HR / superadmin set company holidays here — they show on every employee's calendar.
export default function HolidaysPage() {
  const dispatch = useDispatch();
  const holidays = useSelector((state) => state.holidays.list);
  const [form, setForm] = useState({ date: "", name: "" });

  useEffect(() => { dispatch(fetchHolidays()); }, [dispatch]);

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await dispatch(addHoliday(form));
    if (!result.error) { setForm({ date: "", name: "" }); }
  }

  return (
    <div>
      <h1>Holidays</h1>
      <p className="text-sm text-slate mb-5">Holidays added here appear on everyone's attendance calendar.</p>

      <form onSubmit={handleSubmit} className="flex gap-2 items-end mb-2">
        <div className="flex flex-col">
          <label className="text-xs text-slate mb-1">Date</label>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className="px-3 py-2 border border-line rounded-md text-sm" />
        </div>
        <div className="flex flex-col flex-1 max-w-sm">
          <label className="text-xs text-slate mb-1">Name</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Diwali" required className="px-3 py-2 border border-line rounded-md text-sm" />
        </div>
        <button type="submit" className="btn-primary"><Plus size={15} /> Add holiday</button>
      </form>

      {holidays.length === 0 ? (
        <div className="empty-state mt-4">No holidays added yet.</div>
      ) : (
        <table className="data-table mt-4">
          <thead>
            <tr><th>Date</th><th>Day</th><th>Holiday</th><th></th></tr>
          </thead>
          <tbody>
            {holidays.map((h) => (
              <tr key={h.id}>
                <td>{h.date}</td>
                <td>{new Date(`${h.date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long" })}</td>
                <td>{h.name}</td>
                <td>
                  <button onClick={() => dispatch(deleteHoliday(h.id))} className="p-1 text-slate hover:text-rust"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
