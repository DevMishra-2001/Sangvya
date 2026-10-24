import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { subscribe, dismiss } from "./toast";

const STYLES = {
  success: { Icon: CheckCircle2, accent: "text-leaf", bar: "bg-leaf" },
  error: { Icon: XCircle, accent: "text-rust", bar: "bg-rust" },
  warning: { Icon: AlertTriangle, accent: "text-gold", bar: "bg-gold" },
  info: { Icon: Info, accent: "text-primary", bar: "bg-primary" },
};

// One toast: icon + message + close, auto-hides after its duration
// (paused while hovered), with a shrinking time bar.
function ToastItem({ t }) {
  const { Icon, accent, bar } = STYLES[t.type];
  const [paused, setPaused] = useState(false);
  const remaining = useRef(t.duration);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (paused) return;
    startedAt.current = Date.now();
    const timer = setTimeout(() => dismiss(t.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [paused, t.id]);

  return (
    <div
      role={t.type === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="pointer-events-auto relative w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-card animate-[toast-in_180ms_ease-out]"
      style={{ boxShadow: "var(--shadow-pop)" }}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <Icon size={18} className={`mt-0.5 shrink-0 ${accent}`} />
        <div className="flex-1 text-sm text-ink leading-snug">{t.message}</div>
        <button onClick={() => dismiss(t.id)} className="shrink-0 text-slate hover:text-ink" aria-label="Dismiss notification">
          <X size={15} />
        </button>
      </div>
      <div
        className={`absolute bottom-0 left-0 h-[3px] ${bar} opacity-70`}
        style={{ animation: `toast-timer ${t.duration}ms linear forwards`, animationPlayState: paused ? "paused" : "running" }}
      />
    </div>
  );
}

// Mount once (main.jsx). Renders all active toasts, top-right.
export default function Toaster() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => subscribe(setToasts), []);

  return (
    <div aria-live="polite" className="pointer-events-none fixed top-4 right-4 z-[100] flex flex-col gap-2.5 items-end">
      {toasts.map((t) => <ToastItem key={t.id} t={t} />)}
    </div>
  );
}
