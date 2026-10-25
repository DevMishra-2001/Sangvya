// The one axios instance for every API call. Requests go to this app's own
// /api, which next.config.ts forwards to the backend — so the HttpOnly login
// cookies are same-origin and sent automatically.
//   sangvya_token    access token (short-lived)
//   sangvya_refresh  refresh token, swapped for a new access token via /auth/refresh
import axios, { AxiosError, type AxiosRequestConfig } from "axios";

declare module "axios" {
  interface AxiosRequestConfig {
    _retried?: boolean;
    _skipAuthRetry?: boolean;
  }
}

export interface ApiErrorBody {
  error?: string;
  code?: string;
  details?: { field: string; message: string }[];
}

export const api = axios.create({ baseURL: "/api", withCredentials: true });

// The user this tab is showing. Cookies are shared by all tabs, so if another
// tab logs in as someone else the API answers 409 and we reload instead of
// silently acting as that other user.
let sessionUserId: number | null = null;
export function setSessionUser(id: number | null) {
  sessionUserId = id;
}

// Registered by the app shell: logs the user out locally when the session can't be refreshed.
let sessionEndedHandler: (message: string) => void = () => {};
export function onSessionEnded(handler: (message: string) => void) {
  sessionEndedHandler = handler;
}

// ---- Refresh (single flight: parallel requests share one refresh call) ----
let refreshing: Promise<unknown> | null = null;
export function refreshSession() {
  refreshing ??= api.post("/auth/refresh", null, { _skipAuthRetry: true }).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

api.interceptors.request.use((config) => {
  if (sessionUserId) config.headers.set("X-Expected-User", String(sessionUserId));
  return config;
});

// Endpoints that never trigger a refresh-and-retry
const NO_RETRY = /\/auth\/(login|signup|refresh|logout|forgot-password|verify-otp|reset-password)$/;
const REFRESHABLE = new Set(["TOKEN_EXPIRED", "NO_TOKEN"]);

api.interceptors.response.use(
  (response) => response,
  async (err: AxiosError<ApiErrorBody>) => {
    const { config, response } = err;
    // Use the server's message (e.g. "You can't approve your own leave") as the error message
    if (response?.data?.error) err.message = response.data.error;

    if (response?.status === 409 && response.data?.code === "SESSION_CHANGED") {
      window.location.reload();
      return Promise.reject(err);
    }
    if (response?.status !== 401 || !config || config._skipAuthRetry || NO_RETRY.test(config.url ?? "")) {
      return Promise.reject(err);
    }

    const code = response.data?.code;
    const isStartupCheck = /\/auth\/me$/.test(config.url ?? "") && !sessionUserId;

    // Access token expired → refresh once, then retry the original request
    if (code && REFRESHABLE.has(code) && !config._retried) {
      try {
        await refreshSession();
        return api({ ...(config as AxiosRequestConfig), _retried: true });
      } catch (refreshErr) {
        if (!isStartupCheck) {
          sessionEndedHandler(errorMessage(refreshErr, "Your session has expired. Please log in again."));
        }
        return Promise.reject(err);
      }
    }

    // Session revoked (logged out elsewhere, password changed, …)
    if (!isStartupCheck) sessionEndedHandler(response.data?.error || "Your session has ended. Please log in again.");
    return Promise.reject(err);
  },
);

const GENERIC_ERROR = "Something went wrong. Please try again.";

// A human message for any thrown error (API message first)
export function errorMessage(err: unknown, fallback = GENERIC_ERROR): string {
  if (axios.isAxiosError<ApiErrorBody>(err)) {
    if (err.response?.data?.error) return err.response.data.error;
    if (!err.response) return "Can't reach the server. Check your connection and try again.";
  }
  if (err instanceof Error && err.message && !err.message.startsWith("Request failed with status code")) return err.message;
  return fallback;
}
