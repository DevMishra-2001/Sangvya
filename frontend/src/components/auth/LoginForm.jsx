import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, Link } from "react-router-dom";
import { login } from "../../store/slices/authSlice";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { status } = useSelector((state) => state.auth);

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await dispatch(login({ email, password }));
    if (login.fulfilled.match(result)) navigate("/");
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h1>Log in</h1>
      <label>Email</label>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <label>Password</label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <Link to="/forgot-password" className="self-end mt-2 text-xs text-brass hover:underline">
        Forgot your password?
      </Link>
      <button type="submit" className="btn-primary justify-center mt-5" disabled={status === "loading"}>
        {status === "loading" ? "Logging in..." : "Log in"}
      </button>
      <p className="text-sm text-slate mt-3.5 text-center">
        No account? <Link to="/signup" className="text-brass">Sign up</Link>
      </p>
    </form>
  );
}
