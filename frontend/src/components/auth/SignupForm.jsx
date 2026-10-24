import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, Link } from "react-router-dom";
import { signup } from "../../store/slices/authSlice";
import { PasswordChecklist } from "../formComponent";
import { passwordError } from "../../utils/passwordPolicy";
import { toast } from "../Toast";

export default function SignupForm() {
  const [form, setForm] = useState({ companyName: "", industry: "", name: "", email: "", password: "" });
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { status } = useSelector((state) => state.auth);

  function update(key) {
    return (e) => setForm({ ...form, [key]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const pwError = passwordError(form.password);
    if (pwError) return toast.error(pwError);
    const result = await dispatch(signup(form));
    if (signup.fulfilled.match(result)) navigate("/");
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h1>Create your company account</h1>
      <label>Company name</label>
      <input value={form.companyName} onChange={update("companyName")} required />
      <label>Industry</label>
      <input value={form.industry} onChange={update("industry")} />
      <label>Your name</label>
      <input value={form.name} onChange={update("name")} required />
      <label>Email</label>
      <input type="email" value={form.email} onChange={update("email")} required />
      <label>Password</label>
      <input type="password" value={form.password} onChange={update("password")} required />
      <PasswordChecklist password={form.password} className="mt-2" />
      <button type="submit" className="btn-primary justify-center mt-5" disabled={status === "loading"}>
        {status === "loading" ? "Creating..." : "Create account"}
      </button>
      <p className="text-sm text-slate mt-3.5 text-center">
        Already have an account? <Link to="/login" className="text-brass">Log in</Link>
      </p>
    </form>
  );
}
