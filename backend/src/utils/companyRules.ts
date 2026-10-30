// Company setup rules (the frontend mirrors these in lib/company-rules.ts).
// India IDs are checked offline here (format + cross-checks); a paid
// verification API / Super Admin review can confirm them later.

export const BUSINESS_TYPES = ["pvt_ltd", "public_ltd", "llp", "partnership", "proprietorship", "trust_ngo", "other"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const EMPLOYEE_RANGES = ["2-10", "11-50", "51-200", "201-500", "501-1000", "1000+"] as const;
export const WEEK_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export const ATTENDANCE_MODES = ["office", "remote", "hybrid", "field"] as const;
export const LEAVE_YEARS = ["calendar", "financial"] as const; // Jan–Dec / Apr–Mar
export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD"] as const;

// PAN's 4th letter = holder type. Company C, firm/LLP F, person P, trust T, AOP A
const PAN_HOLDER: Partial<Record<BusinessType, { letters: string; label: string }>> = {
  pvt_ltd: { letters: "C", label: "a company" },
  public_ltd: { letters: "C", label: "a company" },
  llp: { letters: "F", label: "an LLP" },
  partnership: { letters: "F", label: "a partnership firm" },
  proprietorship: { letters: "P", label: "a proprietor (their personal PAN)" },
  trust_ngo: { letters: "TA", label: "a trust / NGO" },
};

// Business types that must give a PAN when the company is in India
export const PAN_REQUIRED: readonly BusinessType[] = ["pvt_ltd", "public_ltd", "llp", "partnership"];

export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const CIN_RE = /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;
export const LLPIN_RE = /^[A-Z]{3}-[0-9]{4}$/;
export const TAN_RE = /^[A-Z]{4}[0-9]{5}[A-Z]$/;

// Problem with this PAN for this business type, or null
export function panProblem(pan: string, businessType: BusinessType | undefined): string | null {
  if (!PAN_RE.test(pan)) return "PAN looks like ABCDE1234F (5 letters, 4 digits, 1 letter)";
  const holder = businessType ? PAN_HOLDER[businessType] : undefined;
  if (holder && !holder.letters.includes(pan[3])) return `The 4th letter of ${holder.label}'s PAN is ${holder.letters.split("").join(" or ")}`;
  return null;
}

// Problem with this GSTIN (format, valid state code, contains the PAN), or null
export function gstinProblem(gstin: string, pan: string | null | undefined): string | null {
  if (!GSTIN_RE.test(gstin)) return "GSTIN looks like 22ABCDE1234F1Z5 (15 characters)";
  const state = Number(gstin.slice(0, 2));
  if (state < 1 || state > 38) return "GSTIN must start with a valid state code (01–38)";
  if (pan && gstin.slice(2, 12) !== pan) return "GSTIN must contain the company PAN (characters 3–12)";
  return null;
}
