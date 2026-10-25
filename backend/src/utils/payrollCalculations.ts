// Statutory payroll calculations for India — simplified for a starter product.
// IMPORTANT: Real payroll compliance (PF ceiling rules, state-wise PT slabs,
// old vs new tax regime, cess, rebates, exemptions) is intricate and changes
// with government notifications. Have a CA/payroll consultant review these
// formulas before running real employee payroll with them.

// ---- Provident Fund ----
// Statutory: 12% of Basic from employee, 12% from employer (employer's 12%
// splits into EPF+EPS in reality, simplified here as one employer figure).
// Government wage ceiling for mandatory PF is ₹15,000 basic.
const PF_RATE = 0.12;
const PF_WAGE_CEILING = 15000;

export function calculatePF(basic: number) {
  const pfWage = Math.min(basic, PF_WAGE_CEILING);
  return { employee: Math.round(pfWage * PF_RATE), employer: Math.round(pfWage * PF_RATE) };
}

// ---- ESI (Employee State Insurance) ----
// Applicable only if gross monthly wage <= ₹21,000. Employee 0.75%, employer 3.25%.
const ESI_WAGE_LIMIT = 21000;
const ESI_EMPLOYEE_RATE = 0.0075;
const ESI_EMPLOYER_RATE = 0.0325;

export function calculateESI(gross: number) {
  if (gross > ESI_WAGE_LIMIT) return { employee: 0, employer: 0 };
  return { employee: Math.round(gross * ESI_EMPLOYEE_RATE), employer: Math.round(gross * ESI_EMPLOYER_RATE) };
}

// ---- Professional Tax ----
// State-wise slabs differ. This uses a common slab pattern (similar to
// Karnataka/Maharashtra) — make it configurable per state before relying on it.
export function calculateProfessionalTax(gross: number) {
  if (gross <= 15000) return 0;
  if (gross <= 25000) return 150;
  return 200;
}

// ---- TDS (Income Tax) — simplified, new regime, FY2024-25-style slabs ----
// Estimates ANNUAL tax from projected annual gross (monthly x 12), applies the
// standard deduction, then divides by 12 for a flat monthly TDS.
const STANDARD_DEDUCTION = 75000;

const NEW_REGIME_SLABS = [
  { upto: 400000, rate: 0 },
  { upto: 800000, rate: 0.05 },
  { upto: 1200000, rate: 0.1 },
  { upto: 1600000, rate: 0.15 },
  { upto: 2000000, rate: 0.2 },
  { upto: 2400000, rate: 0.25 },
  { upto: Infinity, rate: 0.3 },
];

function calculateAnnualTax(taxableIncome: number) {
  let tax = 0;
  let lastLimit = 0;
  for (const slab of NEW_REGIME_SLABS) {
    if (taxableIncome <= lastLimit) break;
    tax += (Math.min(taxableIncome, slab.upto) - lastLimit) * slab.rate;
    lastLimit = slab.upto;
  }
  // Section 87A rebate: income up to ₹12L pays zero tax under new regime.
  if (taxableIncome <= 1200000) tax = 0;
  // 4% health & education cess on top of computed tax.
  return Math.round(tax * 1.04);
}

export function calculateMonthlyTDS(monthlyGross: number) {
  const taxableIncome = Math.max(0, monthlyGross * 12 - STANDARD_DEDUCTION);
  return Math.round(calculateAnnualTax(taxableIncome) / 12);
}

export interface PayslipInput {
  basic: number;
  hra: number;
  allowances: number;
  paidDays: number;
  totalDays: number;
}

// ---- Full payslip calculation ----
// paidDays / totalDays lets absent days reduce gross pay proportionally
// before statutory deductions are applied.
export function calculatePayslip({ basic, hra, allowances, paidDays, totalDays }: PayslipInput) {
  const proration = totalDays > 0 ? paidDays / totalDays : 1;
  const proratedBasic = Math.round(basic * proration);
  const proratedHra = Math.round(hra * proration);
  const proratedAllowances = Math.round(allowances * proration);
  const gross = proratedBasic + proratedHra + proratedAllowances;

  const pf = calculatePF(proratedBasic);
  const esi = calculateESI(gross);
  const professionalTax = calculateProfessionalTax(gross);
  const tds = calculateMonthlyTDS(gross);
  const totalDeductions = pf.employee + esi.employee + professionalTax + tds;

  return {
    basic: proratedBasic,
    hra: proratedHra,
    allowances: proratedAllowances,
    gross,
    pfEmployee: pf.employee,
    pfEmployer: pf.employer,
    esiEmployee: esi.employee,
    esiEmployer: esi.employer,
    professionalTax,
    tds,
    totalDeductions,
    netPay: gross - totalDeductions,
  };
}

export type PayslipCalculation = ReturnType<typeof calculatePayslip>;
