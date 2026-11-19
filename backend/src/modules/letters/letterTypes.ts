// Letter types, their number prefix and a starter body HR can edit (TipTap JSON with {{variables}})
import type { LetterDoc, LetterField, LetterType } from "../../db/schema.js";

export const LETTER_LABEL: Record<LetterType, string> = {
  offer: "Offer letter",
  appointment: "Appointment letter",
  probation_confirmation: "Probation confirmation",
  probation_extension: "Probation extension",
  experience: "Experience letter",
  relieving: "Relieving letter",
  increment: "Salary increment letter",
  warning: "Warning letter",
  noc: "No objection / address proof",
  custom: "Other letter",
};

export const LETTER_PREFIX: Record<LetterType, string> = {
  offer: "OFR",
  appointment: "APT",
  probation_confirmation: "CNF",
  probation_extension: "PEX",
  experience: "EXP",
  relieving: "REL",
  increment: "INC",
  warning: "WRN",
  noc: "NOC",
  custom: "HR",
};

// ---- Tiny builders for the starter bodies ----
type Part = string | LetterDoc;
const t = (text: string): LetterDoc => ({ type: "text", text });
const b = (text: string): LetterDoc => ({ type: "text", text, marks: [{ type: "bold" }] });
const v = (key: string): LetterDoc => ({ type: "variable", attrs: { key } });
const p = (...parts: Part[]): LetterDoc => ({ type: "paragraph", content: parts.map((x) => (typeof x === "string" ? t(x) : x)) });
const right = (...parts: Part[]): LetterDoc => ({ ...p(...parts), attrs: { textAlign: "right" } });
const h = (text: string): LetterDoc => ({ type: "heading", attrs: { level: 3, textAlign: "center" }, content: [b(text)] });
const ul = (...items: Part[][]): LetterDoc => ({ type: "bulletList", content: items.map((parts) => ({ type: "listItem", content: [p(...parts)] })) });
const block = (key: string): LetterDoc => ({ type: "variableBlock", attrs: { key } });
const doc = (...content: LetterDoc[]): LetterDoc => ({ type: "doc", content });

const head = [right("Ref: ", v("letter_number")), right("Date: ", v("today")), p(v("employee_name")), p(v("employee_address"))];

const STARTERS: Partial<Record<LetterType, { body: LetterDoc; fields: LetterField[] }>> = {
  offer: {
    body: doc(
      ...head,
      h("OFFER OF EMPLOYMENT"),
      p("Dear ", v("employee_name"), ","),
      p("We are pleased to offer you the position of ", v("designation"), " in the ", v("department"), " department at ", v("company_name"), ". Your date of joining will be ", v("joining_date"), "."),
      p("Your annual cost to company (CTC) will be ", v("ctc_annual"), " (", v("ctc_annual_words"), "). The break-up is given below:"),
      block("salary_breakup"),
      p("You will be on probation for ", v("probation_months"), " months from your date of joining. This offer is valid until ", v("offer_valid_till"), "."),
      p("Please sign and return a copy of this letter as your acceptance. We look forward to having you with us."),
    ),
    fields: [
      { key: "probation_months", label: "Probation (months)", type: "number", required: true },
      { key: "offer_valid_till", label: "Offer valid till", type: "date", required: true },
    ],
  },
  appointment: {
    body: doc(
      ...head,
      h("APPOINTMENT LETTER"),
      p("Dear ", v("employee_name"), ","),
      p("With reference to your application and the subsequent interview, we are pleased to appoint you as ", v("designation"), " in the ", v("department"), " department with effect from ", v("joining_date"), ", on the following terms:"),
      ul(["Employee code: ", v("employee_code")], ["Reporting to: ", v("manager_name")], ["Annual CTC: ", v("ctc_annual")], ["Probation: ", v("probation_months"), " months"]),
      p("Your employment will be governed by the policies of the company in force from time to time."),
    ),
    fields: [{ key: "probation_months", label: "Probation (months)", type: "number", required: true }],
  },
  probation_confirmation: {
    body: doc(
      ...head,
      h("CONFIRMATION OF EMPLOYMENT"),
      p("Dear ", v("employee_name"), ","),
      p("We are pleased to inform you that, on successful completion of your probation, your employment as ", v("designation"), " is confirmed with effect from ", v("confirmed_on"), "."),
      p("All other terms of your appointment remain unchanged. We wish you continued success."),
    ),
    fields: [],
  },
  probation_extension: {
    body: doc(
      ...head,
      h("EXTENSION OF PROBATION"),
      p("Dear ", v("employee_name"), ","),
      p("Further to the review of your performance, your probation period has been extended till ", v("probation_end_date"), "."),
      p("Reason: ", v("reason")),
    ),
    fields: [{ key: "reason", label: "Reason", type: "textarea", required: true }],
  },
  experience: {
    body: doc(
      right("Date: ", v("today")),
      h("TO WHOMSOEVER IT MAY CONCERN"),
      p("This is to certify that ", v("employee_name"), " (Employee code ", v("employee_code"), ") was employed with ", v("company_name"), " from ", v("joining_date"), " to ", v("last_working_day"), "."),
      p("At the time of leaving, they were working as ", v("designation"), " in the ", v("department"), " department. During their tenure we found them sincere and hardworking."),
      p("We wish them all the best in their future endeavours."),
    ),
    fields: [],
  },
  relieving: {
    body: doc(
      ...head,
      h("RELIEVING LETTER"),
      p("Dear ", v("employee_name"), ","),
      p("This is with reference to your resignation. You are relieved from your duties as ", v("designation"), " at the close of working hours on ", v("last_working_day"), "."),
      p("We confirm that you have completed the exit formalities. We wish you success in the future."),
    ),
    fields: [],
  },
  increment: {
    body: doc(
      ...head,
      h("SALARY REVISION"),
      p("Dear ", v("employee_name"), ","),
      p("In recognition of your contribution, your annual CTC is revised to ", v("ctc_annual"), " (", v("ctc_annual_words"), ") with effect from ", v("effective_from"), "."),
      block("salary_breakup"),
      p("We look forward to your continued contribution."),
    ),
    fields: [{ key: "effective_from", label: "Effective from", type: "date", required: true }],
  },
};

// A blank-but-useful body for a new template of this type
export function starterFor(type: LetterType): { body: LetterDoc; fields: LetterField[] } {
  return STARTERS[type] ?? { body: doc(...head, p("Dear ", v("employee_name"), ","), p("")), fields: [] };
}
