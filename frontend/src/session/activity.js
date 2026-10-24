// Tracks when the user last did something (mouse, keyboard, touch, scroll),
// shared across open tabs with BroadcastChannel (no localStorage). Used to:
//   • refresh the login only while the user is active,
//   • log out after the idle limit,
//   • pause background polling while nobody is looking.
const CHANNEL = "sangvya-session";
const EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"];

let lastActivity = Date.now();
let started = false;
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL) : null;
const listeners = new Set(); // for "logout" / "refreshed" messages from other tabs

let lastBroadcast = 0;
function markActivity() {
  lastActivity = Date.now();
  // Tell other tabs, at most every 15s
  if (channel && lastActivity - lastBroadcast > 15000) {
    lastBroadcast = lastActivity;
    channel.postMessage({ type: "activity", at: lastActivity });
  }
}

if (channel) {
  channel.onmessage = ({ data }) => {
    if (data?.type === "activity") lastActivity = Math.max(lastActivity, data.at);
    else listeners.forEach((l) => l(data));
  };
}

// Start listening for user input (idempotent).
export function startActivityTracking() {
  if (started) return;
  started = true;
  lastActivity = Date.now();
  EVENTS.forEach((e) => window.addEventListener(e, markActivity, { passive: true }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") markActivity();
  });
}

export const getLastActivity = () => lastActivity;

// Was the user active within the last `ms` milliseconds (in any tab)?
export const isUserActive = (ms) => Date.now() - lastActivity < ms;

// Messages to other tabs: { type: "logout", reason } | { type: "refreshed", at }
export function broadcast(message) {
  channel?.postMessage(message);
}

export function onSessionMessage(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
