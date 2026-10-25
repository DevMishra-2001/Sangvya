import { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { fetchEmployees } from "../store/slices/employeesSlice";
import { fetchUsers, addUser, editUser, deleteUser } from "../store/slices/usersSlice";
import { fetchMe } from "../store/slices/authSlice";
import { PasswordChecklist } from "../components/formComponent";
import { passwordError } from "../utils/passwordPolicy";
import { toast } from "../components/Toast";

// Mirrors ROLE_LEVEL in backend/src/config/permissions.js — only used to
// hide options the backend would reject anyway.
const ROLE_LEVEL = { superadmin: 4, hr: 3, manager: 2, employee: 1 };

function assignableRoles(myRole, roles) {
  if (myRole === "superadmin") return roles;
  return roles.filter((r) => ROLE_LEVEL[r] < ROLE_LEVEL[myRole]);
}

// Employees that don't have a login yet (plus the one already linked to `currentUser`, if any).
function linkableEmployees(employees, users, currentUser) {
  const linked = new Set(users.filter((u) => u.employee_id && u.id !== currentUser?.id).map((u) => u.employee_id));
  return employees.filter((e) => !linked.has(e.id));
}

function UserFormModal({ roles, employees, users, onClose }) {
  const dispatch = useDispatch();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: roles[roles.length - 1] || "employee", employeeId: "" });

  function update(key) {
    return (e) => setForm({ ...form, [key]: e.target.value });
  }

  // Picking an employee pre-fills name/email from their record
  function pickEmployee(e) {
    // <select> values are strings; employee ids are numbers
    const emp = employees.find((x) => String(x.id) === e.target.value);
    setForm({
      ...form,
      employeeId: e.target.value,
      name: form.name || emp?.name || "",
      email: form.email || emp?.email || "",
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const pwError = passwordError(form.password);
    if (pwError) return toast.error(pwError);
    const result = await dispatch(addUser(form));
    if (!result.error) onClose();
  }

  return (
    <div className="modal-overlay">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="flex justify-between items-center mb-4">
          <h2>New user login</h2>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <label>Linked employee</label>
        <select value={form.employeeId} onChange={pickEmployee}>
          <option value="">— Not linked —</option>
          {linkableEmployees(employees, users).map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
        </select>
        <label>Name</label>
        <input value={form.name} onChange={update("name")} required />
        <label>Email</label>
        <input type="email" value={form.email} onChange={update("email")} required />
        <label>Password</label>
        <input type="password" value={form.password} onChange={update("password")} required />
        <PasswordChecklist password={form.password} className="mt-2" />
        <label>Role</label>
        <select value={form.role} onChange={update("role")}>
          {roles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <button type="submit" className="btn-primary justify-center mt-5">Create login</button>
      </form>
    </div>
  );
}

export default function UsersPage() {
  const dispatch = useDispatch();
  const me = useSelector((state) => state.auth.user);
  const { list: users, roles } = useSelector((state) => state.users);
  const employees = useSelector((state) => state.employees.list);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    dispatch(fetchUsers());
    dispatch(fetchEmployees());
  }, [dispatch]);

  const myRoles = assignableRoles(me.role, roles);
  const canManage = (u) => u.id !== me.id && (me.role === "superadmin" || ROLE_LEVEL[u.role] < ROLE_LEVEL[me.role]);

  return (
    <div>
      <div className="flex justify-between items-end mb-5">
        <div>
          <h1>Users & Roles</h1>
          <p className="text-sm text-slate">Who can log in, and what their role is.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={15} /> Add user
        </button>
      </div>


      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Linked employee</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const editable = canManage(u);
            return (
              <tr key={u.id}>
                <td>{u.name}{u.id === me.id && <span className="text-xs text-slate"> (you)</span>}</td>
                <td>{u.email}</td>
                <td>
                  {editable ? (
                    <select
                      value={u.role}
                      onChange={(e) => dispatch(editUser({ id: u.id, role: e.target.value }))}
                      className="px-2 py-1 border border-line rounded-md text-sm"
                    >
                      {myRoles.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  ) : (
                    <span className="capitalize">{u.role}</span>
                  )}
                </td>
                <td>
                  {editable || u.id === me.id ? (
                    <select
                      value={u.employee_id || ""}
                      onChange={async (e) => {
                        await dispatch(editUser({ id: u.id, employeeId: e.target.value }));
                        if (u.id === me.id) dispatch(fetchMe()); // refresh own employee link
                      }}
                      className="px-2 py-1 border border-line rounded-md text-sm"
                    >
                      <option value="">— Not linked —</option>
                      {linkableEmployees(employees, users, u).map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                    </select>
                  ) : (
                    u.employee_name || "—"
                  )}
                </td>
                <td>
                  {editable && (
                    <button onClick={() => dispatch(deleteUser(u.id))} className="p-1 text-slate hover:text-rust">
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {showForm && (
        <UserFormModal roles={myRoles} employees={employees} users={users} onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}
