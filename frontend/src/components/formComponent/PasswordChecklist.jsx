import { Check, X } from "lucide-react";
import { PASSWORD_RULES } from "../../utils/passwordPolicy";

/**
 * Live password rules under a password field — each rule turns green when met.
 *
 *   <PasswordChecklist password={form.newPassword} />
 *
 * Props: password (string), className (outer wrapper).
 */
function PasswordChecklist({ password = "", className = "" }) {
  const metCount = PASSWORD_RULES.filter((r) => r.test(password)).length;

  return (
    <div className={className} aria-live="polite">
      <div className="flex gap-1 mb-2" aria-hidden>
        {PASSWORD_RULES.map((r, i) => (
          <span
            key={r.key}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < metCount ? (metCount === PASSWORD_RULES.length ? "bg-leaf" : "bg-gold") : "bg-line"
            }`}
          />
        ))}
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
        {PASSWORD_RULES.map((r) => {
          const met = password.length > 0 && r.test(password);
          return (
            <li key={r.key} className={`flex items-center gap-1.5 text-2xs ${met ? "text-leaf" : "text-slate"}`}>
              {met ? <Check size={12} /> : <X size={12} className="opacity-60" />}
              <span>{r.label}</span>
              <span className="sr-only">{met ? "met" : "not met"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default PasswordChecklist;
