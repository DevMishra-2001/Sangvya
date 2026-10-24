import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { changePassword } from "../store/slices/authSlice";
import { Input } from "../components/formComponent";
import { toast } from "../components/Toast";

const EMPTY = { newPassword: "", confirmPassword: "" };

// Any logged-in user (every role) sets a new password for their own account —
// one row: name · new password · confirm · Update.
export default function ChangePasswordPage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [mismatch, setMismatch] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setMismatch(false);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setMismatch(true);
      toast.error("New password and confirm password don't match");
      return;
    }
    setSaving(true);
    // Success / error toasts come from the store's toastMiddleware
    const result = await dispatch(changePassword({ newPassword: form.newPassword }));
    setSaving(false);
    if (!result.error) setForm(EMPTY);
  }

  return (
    <div>
      <h1 className="mb-4">Change Password</h1>

      <form onSubmit={handleSubmit} className="bg-card border border-line rounded-xl px-5 py-5 flex flex-wrap items-start gap-4">
        <Input
          type="text"
          name="employee"
          id="employeeName"
          lable="Employee"
          value={user?.name || ""}
          readOnly
          respclass="w-full sm:w-64"
          removeFormGroupClass
        />
        <Input
          type="password"
          name="newPassword"
          id="newPassword"
          lable="New Password"
          value={form.newPassword}
          onChange={handleChange}
          required
          showTooltipCount
          respclass="w-full sm:w-64"
          removeFormGroupClass
        />
        <Input
          type="password"
          name="confirmPassword"
          id="confirmPassword"
          lable="Confirm Password"
          value={form.confirmPassword}
          onChange={handleChange}
          required
          error={mismatch}
          respclass="w-full sm:w-64"
          removeFormGroupClass
        />
        <button type="submit" className="btn-primary h-8 py-0 px-5 justify-center" disabled={saving}>
          {saving ? "Updating…" : "Update"}
        </button>
      </form>
    </div>
  );
}
