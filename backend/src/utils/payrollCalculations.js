// Statutory payroll calculations for India — simplified for a starter product.
// IMPORTANT: Real payroll compliance (PF ceiling rules, state-wise PT slabs,
// old vs new tax regime, cess, rebates, exemptions) is intricate and changes
// with government notifications. Have a CA/payroll consultant review these
// formulas before running real employee payroll with them.

// ---- Provident Fund ----
// Statutory: 12% of Basic from employee, 12% from employer (employer's 12%
// splits into EPF+EPS in reality, simplified here as one employer figure).
// Government wage ceiling for mandatory PF is ₹15,000 basic — many companies
// apply PF only up to this ceiling even if actual basic is higher.
const PF_RATE = 0.12;
const PF_WAGE_CEILING = 15000;

function calculatePF(basic) {
  const pfWage = Math.min(basic, PF_WAGE_CEILING);
  const employee = Math.round(pfWage * PF_RATE);
  const employer = Math.round(pfWage * PF_RATE);
  return { employee, employer };
}

// ---- ESI (Employee State Insurance) ----
// Applicable only if gross monthly wage <= ₹21,000.
// Employee: 0.75%, Employer: 3.25% of gross.
const ESI_WAGE_LIMIT = 21000;
const ESI_EMPLOYEE_RATE = 0.0075;
const ESI_EMPLOYER_RATE = 0.0325;

function calculateESI(gross) {
  if (gross > ESI_WAGE_LIMIT) return { employee: 0, employer: 0 };
  return {
    employee: Math.round(gross * ESI_EMPLOYEE_RATE),
    employer: Math.round(gross * ESI_EMPLOYER_RATE),
  };
}

// ---- Professional Tax ----
// State-wise slabs differ significantly. This uses a common slab pattern
// (similar to Karnataka/Maharashtra) as a reasonable default — make this
// configurable per company/state before relying on it for compliance.
function calculateProfessionalTax(gross) {
  if (gross <= 15000) return 0;
  if (gross <= 25000) return 150;
  return 200;
}

// ---- TDS (Income Tax) — simplified, new regime, FY2024-25-style slabs ----
// This estimates ANNUAL tax from the ANNUAL projected gross (monthly gross x 12),
// applies the standard deduction, then divides by 12 for a flat monthly TDS.
// Real payroll TDS also accounts for investment declarations, HRA exemption,
// other income, and mid-year regime changes — this is a starting estimate only.
const STANDARD_DEDUCTION = 75000;

const NEW_REGIME_SLABS = [
  { upto: 400000, rate: 0 },
  { upto: 800000, rate: 0.05 },
  { upto: 1200000, rate: 0.10 },
  { upto: 1600000, rate: 0.15 },
  { upto: 2000000, rate: 0.20 },
  { upto: 2400000, rate: 0.25 },
  { upto: Infinity, rate: 0.30 },
];

function calculateAnnualTax(taxableIncome) {
  let tax = 0;
  let lastLimit = 0;
  for (const slab of NEW_REGIME_SLABS) {
    if (taxableIncome > lastLimit) {
      const amountInSlab = Math.min(taxableIncome, slab.upto) - lastLimit;
      tax += amountInSlab * slab.rate;
      lastLimit = slab.upto;
    } else break;
  }
  // Section 87A rebate: income up to ₹12L pays zero tax under new regime.
  if (taxableIncome <= 1200000) tax = 0;
  // 4% health & education cess on top of computed tax.
  return Math.round(tax * 1.04);
}

function calculateMonthlyTDS(monthlyGross) {
  const annualGross = monthlyGross * 12;
  const taxableIncome = Math.max(0, annualGross - STANDARD_DEDUCTION);
  const annualTax = calculateAnnualTax(taxableIncome);
  return Math.round(annualTax / 12);
}

// ---- Full payslip calculation ----
// paidDays / totalDays lets absent days (from the Attendance module) reduce
// gross pay proportionally before statutory deductions are applied.
function calculatePayslip({ basic, hra, allowances, paidDays, totalDays }) {
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
  const netPay = gross - totalDeductions;

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
    netPay,
  };
}

module.exports = { calculatePayslip, calculatePF, calculateESI, calculateProfessionalTax, calculateMonthlyTDS };
