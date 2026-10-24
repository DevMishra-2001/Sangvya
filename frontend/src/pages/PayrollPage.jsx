import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchEmployees } from "../store/slices/employeesSlice";
import { fetchSalaryStructures, fetchRuns, fetchPayslipsForRun } from "../store/slices/payrollSlice";
import { SalaryStructureTable, SalaryStructureFormModal } from "../components/payroll/SalaryStructure";
import { RunPayrollPanel, PayslipTable } from "../components/payroll/PayrollRun";

const MONTHS = ["", "January","February","March","April","May","June","July","August","September","October","November","December"];

export default function PayrollPage() {
  const dispatch = useDispatch();
  const employees = useSelector((state) => state.employees.list);
  const { structures, runs, payslipsByRun } = useSelector((state) => state.payroll);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [tab, setTab] = useState("structure"); // structure | run

  useEffect(() => {
    dispatch(fetchEmployees());
    dispatch(fetchSalaryStructures());
    dispatch(fetchRuns());
  }, [dispatch]);

  useEffect(() => {
    if (selectedRunId) dispatch(fetchPayslipsForRun(selectedRunId));
  }, [dispatch, selectedRunId]);

  return (
    <div>
      <div className="mb-5">
        <h1>Payroll</h1>
      </div>

      <div className="flex gap-1 mb-4.5 border-b border-line">
        <button
          className={`px-4 py-2.5 bg-transparent border-none border-b-2 text-sm cursor-pointer ${tab === "structure" ? "text-ink font-semibold border-brass" : "text-slate border-transparent"}`}
          onClick={() => setTab("structure")}
        >
          Salary Structure
        </button>
        <button
          className={`px-4 py-2.5 bg-transparent border-none border-b-2 text-sm cursor-pointer ${tab === "run" ? "text-ink font-semibold border-brass" : "text-slate border-transparent"}`}
          onClick={() => setTab("run")}
        >
          Run Payroll
        </button>
      </div>

      {tab === "structure" && (
        <>
          <p className="text-sm text-slate mb-3.5">Set each employee's basic, HRA and allowances — payroll is calculated from these when you run it.</p>
          <SalaryStructureTable employees={employees} structures={structures} onEdit={setEditingEmployee} />
          {editingEmployee && (
            <SalaryStructureFormModal
              employee={editingEmployee}
              structure={structures.find((s) => s.employee_id === editingEmployee.id)}
              onClose={() => setEditingEmployee(null)}
            />
          )}
        </>
      )}

      {tab === "run" && (
        <>
          <RunPayrollPanel />
          <div className="flex gap-5">
            <div className="w-[180px] flex flex-col gap-1.5">
              <h2 className="text-sm">Past runs</h2>
              {runs.length === 0 && <div className="empty-state">No payroll runs yet.</div>}
              {runs.map((r) => (
                <button
                  key={r.id}
                  className={`text-left px-3 py-2.5 border rounded-md text-sm cursor-pointer ${selectedRunId === r.id ? "border-brass bg-goldbg" : "border-line bg-card"}`}
                  onClick={() => setSelectedRunId(r.id)}
                >
                  {MONTHS[r.month]} {r.year}
                </button>
              ))}
            </div>
            <div className="flex-1">
              {selectedRunId ? (
                <PayslipTable payslips={payslipsByRun[selectedRunId] || []} />
              ) : (
                <div className="empty-state">Select a run on the left to see its payslips.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
