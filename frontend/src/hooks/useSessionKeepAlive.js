import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { refreshSession, onSessionEnded, setSessionUser } from "../api/client";
import { logout, sessionEnded } from "../store/slices/authSlice";
import { startActivityTracking, getLastActivity, onSessionMessage, broadcast } from "../session/activity";
import { toast } from "../components/Toast";

const CHECK_EVERY_MS = 30 * 1000;
const WARN_BEFORE_MS = 2 * 60 * 1000; // warning toast this long before the idle logout

// Keeps the login alive while the user works, and ends it when they don't:
//  • refreshes the access token shortly before it expires (every ~5 min),
//    but only if the user did something since the last refresh;
//  • logs out after the idle limit (20 min) with a warning 2 min before;
//  • follows logouts / refreshes done in other tabs.
// Mounted once in App.
export default function useSessionKeepAlive() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const { accessTtlMin, idleMin } = useSelector((state) => state.auth.session);
  const lastRefresh = useRef(Date.now());
  const warned = useRef(false);
  const endSession = useRef(() => {});

  // Session ended by the API (refresh failed / revoked) or by another tab
  useEffect(() => {
    const end = (message, fromOtherTab = false) => {
      setSessionUser(null);
      dispatch(fromOtherTab ? logout({ fromOtherTab: true }) : sessionEnded());
      if (message) toast.warning(message, { duration: 8000 });
      navigate("/login", { replace: true });
    };
    let ending = false;
    endSession.current = (message) => {
      if (ending) return; // many requests may fail at once — handle it once
      ending = true;
      broadcast({ type: "logout" });
      end(message);
      setTimeout(() => { ending = false; }, 2000);
    };
    onSessionEnded((message) => endSession.current(message));
    return onSessionMessage((msg) => {
      if (msg.type === "logout") end(null, true);
      if (msg.type === "refreshed") lastRefresh.current = msg.at;
    });
  }, [dispatch, navigate]);

  // Activity-driven refresh + idle logout
  useEffect(() => {
    if (!user) return;
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
        dispatch(logout()); // ends the server session + other tabs
        toast.warning(`You were logged out after ${idleMin} minutes of inactivity.`, { duration: 8000 });
        navigate("/login", { replace: true });
        return;
      }
      if (idleFor >= idleMs - WARN_BEFORE_MS) {
        if (!warned.current) {
          warned.current = true;
          toast.warning("You've been inactive for a while — you'll be logged out in 2 minutes. Move the mouse or press a key to stay signed in.", { duration: 10000 });
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
          if (err.response?.status === 401) {
            clearInterval(timer);
            endSession.current(err.response.data?.error || "Your session has expired. Please log in again.");
          }
        }
      }
    }, CHECK_EVERY_MS);

    return () => clearInterval(timer);
  }, [user, accessTtlMin, idleMin, dispatch, navigate]);
}
