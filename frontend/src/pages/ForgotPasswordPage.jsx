import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { Mail, ShieldCheck, KeyRound, Check } from "lucide-react";
import { requestPasswordOtp, verifyPasswordOtp, resetForgottenPassword } from "../store/slices/authSlice";
import { Input } from "../components/formComponent";
import { toast } from "../components/Toast";

const STEPS = [
  { key: "email", label: "Email", Icon: Mail },
  { key: "otp", label: "Verify OTP", Icon: ShieldCheck },
  { key: "password", label: "New password", Icon: KeyRound },
];

function Stepper({ step }) {
  const current = STEPS.findIndex((s) => s.key === step);
  return (
    <ol className="flex items-center mb-6">
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.key} className={`flex items-center ${i < STEPS.length - 1 ? "flex-1" : ""}`}>
            <div className="flex flex-col items-center gap-1">
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                  done ? "bg-primary border-primary text-primaryfg" : active ? "border-primary text-primary" : "border-line text-slate"
                }`}
              >
                {done ? <Check size={15} /> : <s.Icon size={15} />}
              </span>
              <span className={`text-2xs whitespace-nowrap ${active ? "text-ink font-semibold" : "text-slate"}`}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <span className={`flex-1 h-0.5 mx-2 mb-5 rounded ${done ? "bg-primary" : "bg-line"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

// Logged-out flow: email → OTP (emailed) → new password → back to login.
// Messages appear as toasts (store toastMiddleware); limits are enforced by the API.
export default function ForgotPasswordPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState(null);
  const [passwords, setPasswords] = useState({ newPassword: "", confirmPassword: "" });
  const [mismatch, setMismatch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0); // seconds until "Resend OTP" is allowed

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function sendOtp() {
    setBusy(true);
    const result = await dispatch(requestPasswordOtp(email.trim()));
    setBusy(false);
    if (result.error) return;
    setResendIn(result.payload.resendAfterSec || 60);
    setOtp("");
    setStep("otp");
  }

  async function handleEmail(e) {
    e.preventDefault();
    sendOtp();
  }

  async function handleVerify(e) {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp)) return toast.error("OTP must be 6 digits");
    setBusy(true);
    const result = await dispatch(verifyPasswordOtp({ email: email.trim(), otp }));
    setBusy(false);
    if (result.error) return;
    setResetToken(result.payload);
    setStep("password");
  }

  async function handleReset(e) {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      setMismatch(true);
      return toast.error("New password and confirm password don't match");
    }
    setBusy(true);
    const result = await dispatch(resetForgottenPassword({ resetToken, newPassword: passwords.newPassword }));
    setBusy(false);
    if (result.error) {
      // Reset window expired → start over
      if (/expired/i.test(result.payload || "")) setStep("email");
      return;
    }
    navigate("/login");
  }

  const updatePassword = (e) => {
    setPasswords({ ...passwords, [e.target.name]: e.target.value });
    setMismatch(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="auth-form !w-[420px]">
        <h1>Forgot password</h1>
        <p className="text-sm text-slate mb-5">
          {step === "email" && "Enter your registered email — we'll send you an OTP."}
          {step === "otp" && <>We sent a 6-digit OTP to <span className="text-ink font-medium">{email}</span> — enter it below.</>}
          {step === "password" && "Now set your new password."}
        </p>

        <Stepper step={step} />

        {step === "email" && (
          <form onSubmit={handleEmail} className="flex flex-col gap-4">
            <Input type="email" name="email" id="fpEmail" lable="Email" value={email} onChange={(e) => setEmail(e.target.value)} required removeFormGroupClass />
            <button type="submit" className="btn-primary justify-center" disabled={busy}>
              {busy ? "Sending…" : "Send OTP"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleVerify} className="flex flex-col gap-4">
            <Input
              type="text"
              name="otp"
              id="fpOtp"
              lable="OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
              display="center"
              className="tracking-[0.5em] font-semibold"
              required
              removeFormGroupClass
            />
            <button type="submit" className="btn-primary justify-center" disabled={busy || otp.length !== 6}>
              {busy ? "Verifying…" : "Verify OTP"}
            </button>
            <div className="flex justify-between text-xs">
              <button type="button" className="text-slate hover:text-ink" onClick={() => setStep("email")}>← Change email</button>
              <button
                type="button"
                className="text-brass disabled:text-slate disabled:cursor-not-allowed"
                onClick={sendOtp}
                disabled={busy || resendIn > 0}
              >
                {resendIn > 0 ? `Resend OTP in ${resendIn}s` : "Resend OTP"}
              </button>
            </div>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={handleReset} className="flex flex-col gap-4">
            <Input type="password" name="newPassword" id="fpNew" lable="New Password" value={passwords.newPassword} onChange={updatePassword} required removeFormGroupClass />
            <Input type="password" name="confirmPassword" id="fpConfirm" lable="Confirm Password" value={passwords.confirmPassword} onChange={updatePassword} error={mismatch} required removeFormGroupClass />
            <button type="submit" className="btn-primary justify-center" disabled={busy}>
              {busy ? "Changing…" : "Change password"}
            </button>
          </form>
        )}

        <p className="text-sm text-slate mt-5 text-center">
          Remembered your password? <Link to="/login" className="text-brass">Log in</Link>
        </p>
      </div>
    </div>
  );
}
