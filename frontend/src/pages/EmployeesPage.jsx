import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { fetchEmployees } from "../store/slices/employeesSlice";
import EmployeeList from "../components/employees/EmployeeList";
import EmployeeFormModal from "../components/employees/EmployeeFormModal";
import useCan from "../hooks/useCan";

export default function EmployeesPage() {
  const dispatch = useDispatch();
  const canManage = useCan()("employees.manage");
  const { list, status } = useSelector((state) => state.employees);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => { dispatch(fetchEmployees()); }, [dispatch]);

  return (
    <div>
      <div className="flex justify-between items-end mb-5">
        <h1>Employees</h1>
        {canManage && <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus size={15} /> Add employee
        </button>}
      </div>
      {status === "loading" ? <p>Loading...</p> : (
        <EmployeeList employees={list} canManage={canManage} onEdit={(emp) => { setEditing(emp); setShowForm(true); }} />
      )}
      {showForm && (
        <EmployeeFormModal initial={editing} onClose={() => { setShowForm(false); setEditing(null); }} />
      )}
    </div>
  );
}
