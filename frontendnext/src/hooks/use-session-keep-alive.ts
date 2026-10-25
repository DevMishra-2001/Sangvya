"use client";

// Keeps the login alive while the user works, and ends it when they don't:
//  • refreshes the access token shortly before it expires, but only if the user
//    did something since the last refresh;
//  • logs out after the idle limit, with a warning 2 minutes before;
//  • follows logouts / refreshes done in other tabs.
// Mounted once by the app shell.
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { errorMessage, onSessionEnded, refreshSession } from "@/lib/api/client";
import { broadcast, getLastActivity, onSessionMessage, startActivityTracking } from "@/lib/session/activity";
import { useAuthStore } from "@/stores/auth-store";

const CHECK_EVERY_MS = 30 * 1000;
const WARN_BEFORE_MS = 2 * 60 * 1000;

export function useSessionKeepAlive() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { accessTtlMin, idleMin } = useAuthStore((s) => s.session);
  const sessionEnded = useAuthStore((s) => s.sessionEnded);
  const logout = useAuthStore((s) => s.logout);
  const lastRefresh = useRef(0);
  const warned = useRef(false);

  // Session ended by the API (refresh failed / revoked) or by another tab
  useEffect(() => {
    let ending = false;
    const end = (message: string | null, fromOtherTab: boolean) => {
      if (ending) return; // many requests may fail at once — handle it once
      ending = true;
      if (fromOtherTab) logout({ fromOtherTab: true });
      else {
        broadcast({ type: "logout" });
        sessionEnded();
      }
      if (message) toast.warning(message, { duration: 8000 });
      router.replace("/login");
      setTimeout(() => (ending = false), 2000);
    };
    onSessionEnded((message) => end(message, false));
    return onSessionMessage((msg) => {
      if (msg.type === "logout") end(null, true);
      if (msg.type === "refreshed") lastRefresh.current = msg.at;
    });
  }, [logout, router, sessionEnded]);

  // Activity-driven refresh + idle logout
  useEffect(() => {
    if (!userId) return;
    startActivityTracking();
    lastRefresh.current = Date.now();
    warned.current = false;

    const refreshEveryMs = Math.max(60 * 1000, accessTtlMin * 60 * 1000 - 30 * 1000); // ~30s before expiry
    const idleMs = idleMin * 60 * 1000;

    const timer = setInterval(async () => {
      const now = Date.now();
      const idleFor = now - getLastActivity();

      if (idleFor >= idleMs) {
        clearInterval(timer);
        await logout(); // ends the server session + other tabs
        toast.warning(`You were logged out after ${idleMin} minutes of inactivity.`, { duration: 8000 });
        router.replace("/login");
        return;
      }
      if (idleFor >= idleMs - WARN_BEFORE_MS) {
        if (!warned.current) {
          warned.current = true;
          toast.warning("You've been inactive for a while — you'll be logged out in 2 minutes. Move the mouse or press a key to stay signed in.", {
            duration: 10000,
          });
        }
      } else {
        warned.current = false;
      }

      // Refresh only if the user was active since the last refresh
      if (now - lastRefresh.current >= refreshEveryMs && getLastActivity() > lastRefresh.current) {
        try {
          await refreshSession();
          lastRefresh.current = Date.now();
          broadcast({ type: "refreshed", at: lastRefresh.current });
        } catch (err) {
          // 401 = idle too long / revoked / expired → logged out; network errors retry next tick
          const status = (err as { response?: { status?: number } }).response?.status;
          if (status === 401) {
            clearInterval(timer);
            sessionEnded();
            toast.warning(errorMessage(err, "Your session has expired. Please log in again."), { duration: 8000 });
            router.replace("/login");
          }
        }
      }
    }, CHECK_EVERY_MS);

    return () => clearInterval(timer);
  }, [userId, accessTtlMin, idleMin, logout, router, sessionEnded]);
}
