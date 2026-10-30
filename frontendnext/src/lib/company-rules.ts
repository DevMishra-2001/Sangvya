// Company setup choices and India ID checks — mirrors backend/src/utils/companyRules.ts

export const BUSINESS_TYPES = [
  { value: "pvt_ltd", label: "Private Limited" },
  { value: "public_ltd", label: "Public Limited" },
  { value: "llp", label: "LLP" },
  { value: "partnership", label: "Partnership" },
  { value: "proprietorship", label: "Proprietorship" },
  { value: "trust_ngo", label: "Trust / NGO" },
  { value: "other", label: "Other" },
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number]["value"];

export const EMPLOYEE_RANGES = [
  { value: "2-10", label: "2 – 10" },
  { value: "11-50", label: "11 – 50" },
  { value: "51-200", label: "51 – 200" },
  { value: "201-500", label: "201 – 500" },
  { value: "501-1000", label: "501 – 1,000" },
  { value: "1000+", label: "1,000+" },
] as const;

export const INDUSTRIES = [
  "IT services",
  "Software / SaaS",
  "Manufacturing",
  "Healthcare",
  "Education",
  "Finance",
  "Retail / E-commerce",
  "Construction",
  "Consulting",
  "Logistics",
  "Hospitality",
  "Marketing / Media",
];

export const WEEK_DAYS = [
  { value: "mon", label: "Mon" },
  { value: "tue", label: "Tue" },
  { value: "wed", label: "Wed" },
  { value: "thu", label: "Thu" },
  { value: "fri", label: "Fri" },
  { value: "sat", label: "Sat" },
  { value: "sun", label: "Sun" },
] as const;
export type WeekDay = (typeof WEEK_DAYS)[number]["value"];

export const ATTENDANCE_MODES = [
  { value: "office", label: "Office (on-site)" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "field", label: "Field / on the move" },
] as const;

export const LEAVE_YEARS = [
  { value: "calendar", label: "Calendar year (Jan – Dec)" },
  { value: "financial", label: "Financial year (Apr – Mar)" },
] as const;

export const CURRENCIES = [
  { value: "INR", label: "INR — Indian Rupee (₹)" },
  { value: "USD", label: "USD — US Dollar ($)" },
  { value: "EUR", label: "EUR — Euro (€)" },
  { value: "GBP", label: "GBP — British Pound (£)" },
  { value: "AED", label: "AED — UAE Dirham" },
  { value: "SGD", label: "SGD — Singapore Dollar" },
] as const;

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const TIMEZONES = [
  { value: "Asia/Kolkata", label: "India (IST, UTC+5:30)" },
  { value: "Asia/Dubai", label: "Dubai (UTC+4)" },
  { value: "Asia/Singapore", label: "Singapore (UTC+8)" },
  { value: "Asia/Kathmandu", label: "Nepal (UTC+5:45)" },
  { value: "Asia/Dhaka", label: "Bangladesh (UTC+6)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Berlin", label: "Central Europe (CET)" },
  { value: "America/New_York", label: "US Eastern" },
  { value: "America/Chicago", label: "US Central" },
  { value: "America/Los_Angeles", label: "US Pacific" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
];

// Office hours in 30-minute steps: 06:00 … 23:30
export const TIMES = Array.from({ length: 36 }, (_, i) => {
  const minutes = 6 * 60 + i * 30;
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  const h12 = ((Math.floor(minutes / 60) + 11) % 12) + 1;
  return { value: `${hh}:${mm}`, label: `${h12}:${mm} ${minutes < 12 * 60 ? "AM" : "PM"}` };
});

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
  "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha",
  "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Lakshadweep", "Puducherry",
];

// GST state codes (first 2 digits of a GSTIN)
export const GST_STATES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
  "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh",
  "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat", "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
};

export const PAN_REQUIRED: readonly string[] = ["pvt_ltd", "public_ltd", "llp", "partnership"];
const PAN_HOLDER: Record<string, { letters: string; label: string }> = {
  pvt_ltd: { letters: "C", label: "a company" },
  public_ltd: { letters: "C", label: "a company" },
  llp: { letters: "F", label: "an LLP" },
  partnership: { letters: "F", label: "a partnership firm" },
  proprietorship: { letters: "P", label: "a proprietor (their personal PAN)" },
  trust_ngo: { letters: "TA", label: "a trust / NGO" },
};

export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const CIN_RE = /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;
export const LLPIN_RE = /^[A-Z]{3}-[0-9]{4}$/;
export const TAN_RE = /^[A-Z]{4}[0-9]{5}[A-Z]$/;

export function panProblem(pan: string, businessType: string | undefined): string | null {
  if (!PAN_RE.test(pan)) return "PAN looks like ABCDE1234F (5 letters, 4 digits, 1 letter)";
  const holder = businessType ? PAN_HOLDER[businessType] : undefined;
  if (holder && !holder.letters.includes(pan[3])) return `The 4th letter of ${holder.label}'s PAN is ${holder.letters.split("").join(" or ")}`;
  return null;
}

export function gstinProblem(gstin: string, pan: string | null | undefined): string | null {
  if (!GSTIN_RE.test(gstin)) return "GSTIN looks like 22ABCDE1234F1Z5 (15 characters)";
  const state = Number(gstin.slice(0, 2));
  if (state < 1 || state > 38) return "GSTIN must start with a valid state code (01–38)";
  if (pan && gstin.slice(2, 12) !== pan) return "GSTIN must contain the company PAN (characters 3–12)";
  return null;
}

// "27ABCDE1234F1Z5" → "Maharashtra"
export const gstState = (gstin: string) => (GSTIN_RE.test(gstin) ? (GST_STATES[gstin.slice(0, 2)] ?? null) : null);
