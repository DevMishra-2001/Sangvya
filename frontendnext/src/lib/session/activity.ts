// Tracks when the user last did something (mouse, keyboard, touch, scroll),
// shared across open tabs with BroadcastChannel. Used to:
//   • refresh the login only while the user is active,
//   • log out after the idle limit,
//   • pause background polling while nobody is looking.
const CHANNEL = "sangvya-session";
const EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"] as const;

export type SessionMessage = { type: "logout" } | { type: "refreshed"; at: number } | { type: "activity"; at: number };

let lastActivity = Date.now();
let lastBroadcast = 0;
let started = false;
let channel: BroadcastChannel | null = null;
const listeners = new Set<(msg: SessionMessage) => void>();

function getChannel() {
  if (!channel && typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = ({ data }: MessageEvent<SessionMessage>) => {
      if (data?.type === "activity") lastActivity = Math.max(lastActivity, data.at);
      else if (data) listeners.forEach((l) => l(data));
    };
  }
  return channel;
}

function markActivity() {
  lastActivity = Date.now();
  // Tell other tabs, at most every 15s
  if (lastActivity - lastBroadcast > 15000) {
    lastBroadcast = lastActivity;
    getChannel()?.postMessage({ type: "activity", at: lastActivity });
  }
}

// Start listening for user input (idempotent)
export function startActivityTracking() {
  if (started || typeof window === "undefined") return;
  started = true;
  lastActivity = Date.now();
  getChannel();
  EVENTS.forEach((e) => window.addEventListener(e, markActivity, { passive: true }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") markActivity();
  });
}

export const getLastActivity = () => lastActivity;

// Was the user active within the last `ms` milliseconds (in any tab)?
export const isUserActive = (ms: number) => Date.now() - lastActivity < ms;

export function broadcast(message: SessionMessage) {
  getChannel()?.postMessage(message);
}

export function onSessionMessage(listener: (msg: SessionMessage) => void) {
  getChannel();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
