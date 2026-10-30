// Password rules as a floating tooltip instead of a list under the field: it
// appears while the password field (anything inside the `group/pw` wrapper) has
// focus, so it never pushes the form down.
//   <PasswordHint password={pw}><PasswordInput … /></PasswordHint>
// Or, in a custom layout, give the wrapper `group/pw relative` and drop in
//   <PasswordPopover password={pw} className="top-[3.25rem]" />
import { cn } from "@/lib/utils";
import { PasswordChecklist } from "./password-checklist";

export function PasswordPopover({ password, className }: { password: string | undefined; className?: string }) {
  return (
    <div
      role="tooltip"
      className={cn(
        "pointer-events-none absolute top-full left-0 z-50 mt-2 hidden w-full min-w-64 max-w-sm rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg group-focus-within/pw:block",
        className,
      )}
    >
      <span aria-hidden className="absolute -top-1.5 left-6 size-3 rotate-45 border-t border-l bg-popover" />
      <p className="mb-2 text-xs font-medium">Your password needs</p>
      <PasswordChecklist password={password ?? ""} compact />
    </div>
  );
}

export function PasswordHint({ password, className, children }: { password: string | undefined; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("group/pw relative", className)}>
      {children}
      <PasswordPopover password={password} />
    </div>
  );
}
