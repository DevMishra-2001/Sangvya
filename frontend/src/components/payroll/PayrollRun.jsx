import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Download, PlayCircle } from "lucide-react";
import { runPayroll, downloadPayslip } from "../../store/slices/payrollSlice";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export function RunPayrollPanel() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const dispatch = useDispatch();
  const { status } = useSelector((state) => state.payroll);

  async function handleRun() {
    await dispatch(runPayroll({ month, year }));
  }

  return (
    <div className="flex items-center gap-2.5 bg-card border border-line rounded-lg px-4.5 py-3.5 mb-5">
      <select
        value={month}
        onChange={(e) => setMonth(Number(e.target.value))}
        className="px-2.5 py-2 border border-line rounded-md text-sm"
      >
        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <input
        type="number"
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
        className="w-[90px] px-2.5 py-2 border border-line rounded-md text-sm"
      />
      <button className="btn-primary" onClick={handleRun} disabled={status === "loading"}>
        <PlayCircle size={15} /> {status === "loading" ? "Running..." : "Run payroll"}
      </button>
    </div>
  );
}

export function PayslipTable({ payslips }) {
  const dispatch = useDispatch();

  if (payslips.length === 0) {
    return <div className="empty-state">No payslips in this run yet.</div>;
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Employee</th>
          <th>Gross</th>
          <th>PF</th>
          <th>ESI</th>
          <th>PT</th>
          <th>TDS</th>
          <th>Net Pay</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {payslips.map((p) => (
          <tr key={p.id}>
            <td>{p.employee_name}</td>
            <td>₹{Number(p.gross).toLocaleString("en-IN")}</td>
            <td>₹{Number(p.pf_employee).toLocaleString("en-IN")}</td>
            <td>₹{Number(p.esi_employee).toLocaleString("en-IN")}</td>
            <td>₹{Number(p.professional_tax).toLocaleString("en-IN")}</td>
            <td>₹{Number(p.tds).toLocaleString("en-IN")}</td>
            <td className="font-semibold">₹{Number(p.net_pay).toLocaleString("en-IN")}</td>
            <td>
              <button onClick={() => dispatch(downloadPayslip(p.id))} className="p-1 text-slate hover:text-ink">
                <Download size={14} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
