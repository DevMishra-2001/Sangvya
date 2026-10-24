// Tiny toast store — no React needed to fire one, so it works from components,
// Redux middleware, the API client, anywhere:
//
//   import { toast } from "../components/Toast";
//   toast.success("Leave request submitted");
//   toast.error("Could not save");            // also: toast.info / toast.warning
//   toast.success("Saved", { duration: 2000 });
//
// <Toaster /> (mounted once in main.jsx) renders whatever is in here.

const DEFAULT_DURATION = { success: 3000, info: 3500, warning: 4500, error: 5000 };
const MAX_VISIBLE = 4;

let toasts = [];
let nextId = 1;
const listeners = new Set();

function emit() {
  listeners.forEach((l) => l(toasts));
}

export function subscribe(listener) {
  listeners.add(listener);
  listener(toasts);
  return () => listeners.delete(listener);
}

export function dismiss(id) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function show(type, message, { duration } = {}) {
  if (!message) return null;
  // Same message already on screen? Restart it instead of stacking duplicates.
  const existing = toasts.find((t) => t.type === type && t.message === message);
  if (existing) dismiss(existing.id);

  const id = nextId++;
  toasts = [...toasts, { id, type, message, duration: duration ?? DEFAULT_DURATION[type] }].slice(-MAX_VISIBLE);
  emit();
  return id;
}

export const toast = {
  success: (message, opts) => show("success", message, opts),
  error: (message, opts) => show("error", message, opts),
  info: (message, opts) => show("info", message, opts),
  warning: (message, opts) => show("warning", message, opts),
  dismiss,
};
