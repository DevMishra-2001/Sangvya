import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { fetchEmployees } from "../store/slices/employeesSlice";
import { fetchLeaves } from "../store/slices/leaveSlice";
import useCan from "../hooks/useCan";
import LeaveList from "../components/leave/LeaveList";
import LeaveRequestForm from "../components/leave/LeaveRequestForm";

export default function LeavePage() {
  const dispatch = useDispatch();
  const can = useCan();
  const user = useSelector((state) => state.auth.user);
  const employees = useSelector((state) => state.employees.list);
  const leaves = useSelector((state) => state.leave.list);
  const [showForm, setShowForm] = useState(false);

  const forOthers = can("leave.applyForOthers");
  // Can apply if they may pick any employee, or their login is linked to an employee record
  const canApply = forOthers ? employees.length > 0 : Boolean(user.employee_id);

  useEffect(() => {
    if (forOthers) dispatch(fetchEmployees());
    dispatch(fetchLeaves());
  }, [dispatch, forOthers]);

  return (
    <div>
      <div className="flex justify-between items-end mb-5">
        <h1>Leave</h1>
        <button className="btn-primary" disabled={!canApply} onClick={() => setShowForm(true)}>
          <Plus size={15} /> New request
        </button>
      </div>
      {!forOthers && !user.employee_id && (
        <div className="text-sm text-rust mb-3">Your login isn't linked to an employee record — please ask HR to link it.</div>
      )}
      <LeaveList leaves={leaves} canApprove={can("leave.approve")} myEmployeeId={user.employee_id} />
      {showForm && (
        <LeaveRequestForm
          employees={forOthers ? employees : null}
          defaultEmployeeId={user.employee_id}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
