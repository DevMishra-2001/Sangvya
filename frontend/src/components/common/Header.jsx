import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { LogOut } from "lucide-react";
import { logout } from "../../store/slices/authSlice";
import ThemeToggle from "./ThemeToggle";
import WorkTimer from "./WorkTimer";
import SettingsMenu from "../settings/SettingsMenu";
import Tooltip from "../Tooltip";

// Greeting + matching emoji for the viewer's local time of day.
function greetingFor(date) {
  const h = date.getHours();
  if (h >= 5 && h < 12) return { text: "Good Morning", emoji: "🌅" };
  if (h >= 12 && h < 17) return { text: "Good Afternoon", emoji: "☀️" };
  if (h >= 17 && h < 21) return { text: "Good Evening", emoji: "🌇" };
  return { text: "Good Night", emoji: "🌙" };
}

// Top header on every logged-in page (all roles): time-based greeting on the
// left, today's working time in the center, settings/theme/Log out on the right.
export default function Header() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const [now, setNow] = useState(new Date());

  // Re-check every minute so the greeting changes as the day goes on
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const greeting = greetingFor(now);

  function handleLogout() {
    dispatch(logout());
    navigate("/login");
  }

  return (
    <header className="h-[72px] px-10 bg-card/80 backdrop-blur-md border-b border-line grid grid-cols-[1fr_auto_1fr] items-center gap-4 sticky top-0 z-30">
      {/* Left: greeting */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-11 h-11 shrink-0 rounded-xl bg-goldbg flex items-center justify-center text-2xl" aria-hidden>
          {greeting.emoji}
        </div>
        <div className="min-w-0">
          <div className="font-serif text-greet leading-tight text-ink truncate">
            Hi! <span className="font-semibold text-primary">{user?.name}</span>
            <span className="text-slate">,</span> <span className="text-brass">{greeting.text}</span>
          </div>
          <div className="text-xs text-slate mt-0.5">
            {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
      </div>

      {/* Center: today's working time vs 9h */}
      <div className="justify-self-center">
        <WorkTimer />
      </div>

      {/* Right: settings, theme, log out */}
      <div className="flex items-center gap-2 justify-self-end">
        <SettingsMenu />
        <ThemeToggle />
        <Tooltip content="Sign out of Sangvya" placement="bottom">
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 h-9 px-3 border border-line rounded-lg text-sm text-ink bg-card hover:bg-rustbg hover:text-rust hover:border-rust/30 transition-colors"
          >
            <LogOut size={15} /> Log out
          </button>
        </Tooltip>
      </div>
    </header>
  );
}
