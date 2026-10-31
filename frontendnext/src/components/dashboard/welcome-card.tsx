"use client";

import { useEffect, useState } from "react";
import { Moon, Sparkles, Sun, Sunrise, Sunset, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

interface Period {
  greeting: string;
  icon: LucideIcon;
  bg: string; // gradient (white text on top, same in light and dark mode)
  line: string;
}

// Morning 5–12 · afternoon 12–17 · evening 17–21 · night
function periodOf(hour: number): Period {
  if (hour >= 5 && hour < 12) return { greeting: "Good morning", icon: Sunrise, bg: "from-amber-400 via-orange-400 to-rose-500", line: "A fresh start — here's your day." };
  if (hour >= 12 && hour < 17) return { greeting: "Good afternoon", icon: Sun, bg: "from-sky-400 via-blue-500 to-indigo-600", line: "Keep going — here's how today looks." };
  if (hour >= 17 && hour < 21) return { greeting: "Good evening", icon: Sunset, bg: "from-orange-500 via-rose-500 to-purple-700", line: "Wrapping up — here's where things stand." };
  return { greeting: "Good night", icon: Moon, bg: "from-indigo-950 via-violet-900 to-slate-900", line: "Working late? Here's a quick look." };
}

// Dashboard's first card: greeting, name and date, coloured by the time of day
export function WelcomeCard() {
  const user = useAuthStore((s) => s.user);
  const company = useAuthStore((s) => s.company);
  // The browser's clock only (the server's time zone may differ)
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);

  const p = periodOf(now?.getHours() ?? 12);
  const Icon = p.icon;
  const night = p.greeting === "Good night";
  const first = user?.name.split(" ")[0] ?? "";

  return (
    <section className={cn("relative h-full overflow-hidden rounded-xl bg-linear-to-br p-4 text-white shadow-sm sm:px-6 sm:py-5", p.bg, !now && "opacity-0")} aria-label="Welcome">
      {/* Soft shapes */}
      <span className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-white/15 blur-2xl" aria-hidden />
      <span className="pointer-events-none absolute -bottom-20 left-1/3 size-52 rounded-full bg-white/10 blur-2xl" aria-hidden />
      {night && (
        <span className="pointer-events-none absolute inset-0" aria-hidden>
          {[
            [12, 18],
            [28, 62],
            [46, 22],
            [64, 48],
            [78, 16],
            [88, 70],
            [56, 80],
          ].map(([x, y]) => (
            <span key={`${x}-${y}`} className="absolute size-1 animate-pulse rounded-full bg-white/70" style={{ left: `${x}%`, top: `${y}%` }} />
          ))}
        </span>
      )}

      <div className="relative flex items-center gap-4 sm:gap-5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/30 backdrop-blur-sm">
          <Icon className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white/85">{p.greeting},</p>
          <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl" title={user?.name}>
            {first}
            <span className="hidden sm:inline">{user?.name.slice(first.length)}</span>
          </h1>
          <p className="mt-0.5 truncate text-xs text-white/85 sm:text-sm">{p.line}</p>
        </div>
        <div className="hidden shrink-0 text-right md:block">
          <p className="text-2xl font-semibold tabular-nums">{now?.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</p>
          <p className="text-xs text-white/85">{now?.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
      </div>

      {/* Date + company as chips on small screens */}
      <div className="relative mt-3 flex flex-wrap gap-2 md:hidden">
        <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium ring-1 ring-white/25">
          {now?.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} · {now?.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
        </span>
        {company && (
          <span className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-medium ring-1 ring-white/25">
            <Sparkles className="size-3" /> {company.name}
          </span>
        )}
      </div>
    </section>
  );
}
