import axios from "axios";

// The login tokens are HttpOnly cookies set by the backend — this code never
// sees or stores them. `withCredentials` makes the browser send them.
//   sangvya_token   access token, valid ACCESS_TOKEN_TTL_MIN (5 min)
//   sangvya_refresh refresh token, swapped for a new access token via /auth/refresh
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  withCredentials: true,
});

// Older builds kept the token / font size in localStorage — wipe those leftovers.
try {
  localStorage.removeItem("sangvya_token");
  localStorage.removeItem("sangvya_font_size");
} catch {
  // storage blocked — nothing to clean
}

// The user this tab is showing. The cookies are shared by all tabs, so if
// another tab logs in as someone else, the API sees the mismatch (409) and we
// reload instead of silently acting as that other user.
let sessionUserId = null;
export function setSessionUser(id) {
  sessionUserId = id || null;
}

// App registers this to log the user out (clear state, toast, go to /login)
// when the session can't be refreshed any more.
let sessionEndedHandler = () => {};
export function onSessionEnded(handler) {
  sessionEndedHandler = handler;
}

// ---- Refresh (single flight: parallel requests share one refresh call) ----
let refreshing = null;
export function refreshSession() {
  if (!refreshing) {
    refreshing = client
      .post("/auth/refresh", null, { _skipAuthRetry: true })
      .then((res) => res.data)
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

client.interceptors.request.use((config) => {
  if (sessionUserId) config.headers["X-Expected-User"] = sessionUserId;
  return config;
});

// Endpoints that never trigger a refresh-and-retry.
const NO_RETRY = /\/auth\/(login|signup|refresh|logout|forgot-password|verify-otp|reset-password)$/;
const REFRESHABLE = new Set(["TOKEN_EXPIRED", "NO_TOKEN"]);

client.interceptors.response.use(
  (res) => res,
  async (err) => {
    const { config, response } = err;
    // Use the server's message (e.g. "You can't approve your own leave") as the
    // error message, so every thunk's failure toast says something useful.
    if (response?.data?.error) err.message = response.data.error;

    if (response?.status === 409 && response.data?.code === "SESSION_CHANGED") {
      window.location.reload();
      return Promise.reject(err);
    }

    if (response?.status !== 401 || !config || config._skipAuthRetry || NO_RETRY.test(config.url || "")) {
      return Promise.reject(err);
    }

    const code = response.data?.code;
    const isStartupCheck = /\/auth\/me$/.test(config.url || "") && !sessionUserId;

    // Access token expired (or dropped by the browser) → refresh once, retry
    if (REFRESHABLE.has(code) && !config._retried) {
      try {
        await refreshSession();
        return client({ ...config, _retried: true });
      } catch (refreshErr) {
        // Not logged in at all (e.g. opening the login page) — nothing to announce
        if (!isStartupCheck) sessionEndedHandler(refreshErr.response?.data?.error || "Your session has expired. Please log in again.");
        return Promise.reject(err);
      }
    }

    // Session revoked (logged out elsewhere, password changed, …)
    if (!isStartupCheck) sessionEndedHandler(response.data?.error || "Your session has ended. Please log in again.");
    return Promise.reject(err);
  }
);

export default client;
