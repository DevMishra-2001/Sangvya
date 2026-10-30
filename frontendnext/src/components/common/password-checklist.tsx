import { Check, X } from "lucide-react";
import { PASSWORD_RULES } from "@/lib/password-policy";
import { cn } from "@/lib/utils";

// Live password rules under a password field — each rule turns green when met
export function PasswordChecklist({ password = "", className, compact }: { password?: string; className?: string; compact?: boolean }) {
  const met = PASSWORD_RULES.filter((r) => r.test(password)).length;

  return (
    <div className={className} aria-live="polite">
      <div className="mb-2 flex gap-1" aria-hidden>
        {PASSWORD_RULES.map((r, i) => (
          <span
            key={r.key}
            className={cn("h-1 flex-1 rounded-full transition-colors", i < met ? (met === PASSWORD_RULES.length ? "bg-success" : "bg-warning") : "bg-border")}
          />
        ))}
      </div>
      <ul className={cn("grid gap-x-4 gap-y-1", compact ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")}>
        {PASSWORD_RULES.map((r) => {
          const ok = password.length > 0 && r.test(password);
          return (
            <li key={r.key} className={cn("flex items-center gap-1.5 text-xs", ok ? "text-success" : "text-muted-foreground")}>
              {ok ? <Check className="size-3" /> : <X className="size-3 opacity-60" />}
              <span>{r.label}</span>
              <span className="sr-only">{ok ? "met" : "not met"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
