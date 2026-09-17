/** Optional working-paper suggestions. Monetary values are integer PHP centavos.
 * Sources, exclusions and verification limits: PAYROLL-STATUTORY.md.
 * Never infer contribution bases from gross pay or apply monthly amounts to each cutoff.
 */
export const payrollStatutoryVerifiedOn = '2026-09-17' as const
export const payrollStatutoryVersion = 'ph-reviewed-2026-09-17-v1' as const
export const payrollStatutorySources = {
  sss: { title: 'SSS Circular 2024-006: business employers and employees', effectiveFrom: '2025-01-01', url: 'https://www.sss.gov.ph/wp-content/uploads/2024/12/2025-SSS-Contribution-Table-rev.pdf' },
  philhealth: { title: 'PhilHealth Advisory 2025-0002: contribution basis', effectiveFrom: '2025-01-01', url: 'https://www.philhealth.gov.ph/advisories/2025/PA2025-0002.pdf' },
  philhealth2026: { title: 'PIA report of PhilHealth’s 2026 premium announcement, 14 May 2026', effectiveFrom: '2026-01-01', url: 'https://pia.gov.ph/news/philhealth-sets-5-premium-contribution-rate-for-2026/' },
  pagibig: { title: 'DOLE Workers Statutory Monetary Benefits Handbook 2024, printed p63, citing Pag-IBIG Circular 460', effectiveFrom: '2024-02-01', url: 'https://nwpc.dole.gov.ph/wp-content/uploads/2024/11/Workers-Statutory-Monetary-Benefits-Handbook-2024-Edition.pdf' },
  pagibigEffectivity: { title: 'DBM Circular Letter 2024-2: Circular 460 effectivity and maximum fund salary', effectiveFrom: '2024-02-01', url: 'https://www.dbm.gov.ph/wp-content/uploads/Issuances/2024/Circular-Letter/CIRCULAR-LETTER-NO-2024-2-DATED-FEBRUARY-01-2024.pdf' },
  bir: { title: 'BIR RR 11-2018 Annex E: revised compensation withholding table', effectiveFrom: '2023-01-01', url: 'https://bir-cdn.bir.gov.ph/local/pdf/Annex%20E%20RR%2011-2018.pdf' },
} as const
export type StatutoryFrequency = 'monthly' | 'semi_monthly' | 'weekly' | 'daily'
export interface MonthlyContributionInput {
  contributionMonth: string
  scope: 'ordinary_private_employee_full_month'
  basesReviewed: boolean
  reviewNote: string
  sssMonthlyCompensation: number
  philhealthMonthlyBasicSalary: number
  pagibigMonthlyFundSalary: number
}
export interface CompensationWithholdingInput {
  payDate: string
  frequency: StatutoryFrequency
  scope: 'regular_single_employer_period'
  basesReviewed: boolean
  reviewNote: string
  taxableCompensation: number
}
export interface StatutoryMetadata {
  version: typeof payrollStatutoryVersion
  verifiedOn: typeof payrollStatutoryVerifiedOn
  reviewRequired: true
  reviewNote: string
  rounding: 'nearest_centavo_half_up'
  warnings: string[]
}
export interface MonthlyContributionSuggestion extends StatutoryMetadata {
  basis: MonthlyContributionInput
  periodBasis: 'calendar_month'
  sss: { monthlySalaryCredit: number; regularSalaryCredit: number; providentSalaryCredit: number; regularEmployee: number; regularEmployer: number; providentEmployee: number; providentEmployer: number; employee: number; employer: number; ecEmployer: number; totalRemittance: number }
  philhealth: { cappedBasicSalary: number; premium: number; employee: number; employer: number; calculatedUnsplitPremium: number; roundingDifference: number }
  pagibig: { cappedFundSalary: number; employeeRatePercent: number; employerRatePercent: 2; employee: number; employer: number; totalRemittance: number }
  /** Whole-month suggestions only. Do not apply to multiple pay cutoffs. */
  monthlyAmounts: { sssEmployee: number; sssEmployer: number; ecEmployer: number; philhealthEmployee: number; philhealthEmployer: number; pagibigEmployee: number; pagibigEmployer: number }
  sources: (typeof payrollStatutorySources)[keyof typeof payrollStatutorySources][]
}
export interface CompensationWithholdingSuggestion extends StatutoryMetadata {
  basis: CompensationWithholdingInput
  periodBasis: StatutoryFrequency
  bracket: number
  threshold: number
  fixedTax: number
  ratePercent: number
  excess: number
  withholdingTax: number
  sources: (typeof payrollStatutorySources)[keyof typeof payrollStatutorySources][]
}
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Enter a reviewed statutory calculation record.')
  return value as Record<string, unknown>
}
function amount(value: unknown, label: string, positive = false) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < (positive ? 1 : 0) || value > 1e10) throw Error(`${label} must be ${positive ? 'positive' : 'non-negative'} whole centavos, up to ₱100 million. Zero-pay and special cases need manual review.`)
  return value
}
function review(value: Record<string, unknown>) {
  if (value.basesReviewed !== true || typeof value.reviewNote !== 'string' || value.reviewNote.trim().length < 10 || value.reviewNote.length > 1000) throw Error('Confirm the employee scope and each statutory basis, and enter a review note of 10–1,000 characters.')
  return value.reviewNote.trim()
}
function date(value: unknown) {
  if (typeof value !== 'string' || !/^2026-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw Error('This reviewed calculator supports valid 2026 pay dates only; other years need separate tables.')
  if (value > payrollStatutoryVerifiedOn) throw Error(`The pay date is after the table verification date (${payrollStatutoryVerifiedOn}); verify later pronouncements and calculate manually.`)
  return value
}
/** Integer arithmetic: round a nonnegative rational to the nearest centavo, half up. */
function portion(value: number, numerator: number, denominator: number) {
  const n = BigInt(value) * BigInt(numerator), d = BigInt(denominator)
  return Number((n * 2n + d) / (d * 2n))
}
function metadata(reviewNote: string): StatutoryMetadata {
  return { version: payrollStatutoryVersion, verifiedOn: payrollStatutoryVerifiedOn, reviewRequired: true, reviewNote, rounding: 'nearest_centavo_half_up', warnings: ['These are reviewed-input working-paper suggestions. Reconcile the agency assessment and payroll before approval; the helper does not file or remit contributions.'] }
}
export function suggestMonthlyContributions(value: unknown): MonthlyContributionSuggestion {
  const v = record(value), reviewNote = review(v)
  if (v.scope !== 'ordinary_private_employee_full_month') throw Error('Monthly suggestions cover ordinary private business employees for a full month with one employer. Household, government, overseas, self-employed, partial-month, no-pay, concurrent-employer and other special cases need manual review.')
  if (typeof v.contributionMonth !== 'string' || !/^2026-(0[1-9]|1[0-2])$/.test(v.contributionMonth) || v.contributionMonth > payrollStatutoryVerifiedOn.slice(0, 7)) throw Error('Choose a 2026 contribution month no later than the verified month; other periods require manual review.')
  const sssMonthlyCompensation = amount(v.sssMonthlyCompensation, 'SSS monthly compensation', true), philhealthMonthlyBasicSalary = amount(v.philhealthMonthlyBasicSalary, 'PhilHealth fixed monthly basic salary', true), pagibigMonthlyFundSalary = amount(v.pagibigMonthlyFundSalary, 'Pag-IBIG monthly fund salary', true)
  const basis: MonthlyContributionInput = { contributionMonth: v.contributionMonth, scope: 'ordinary_private_employee_full_month', basesReviewed: true, reviewNote, sssMonthlyCompensation, philhealthMonthlyBasicSalary, pagibigMonthlyFundSalary }
  // SSS salary-band midpoints are literal table boundaries, not ordinary decimal rounding.
  const monthlySalaryCredit = Math.min(3500000, Math.max(500000, Math.floor((sssMonthlyCompensation + 25000) / 50000) * 50000))
  const regularSalaryCredit = Math.min(monthlySalaryCredit, 2000000), providentSalaryCredit = monthlySalaryCredit - regularSalaryCredit
  const regularEmployee = portion(regularSalaryCredit, 5, 100), regularEmployer = portion(regularSalaryCredit, 10, 100), providentEmployee = portion(providentSalaryCredit, 5, 100), providentEmployer = portion(providentSalaryCredit, 10, 100)
  const employee = regularEmployee + providentEmployee, employer = regularEmployer + providentEmployer, ecEmployer = monthlySalaryCredit >= 1500000 ? 3000 : 1000
  const sss = { monthlySalaryCredit, regularSalaryCredit, providentSalaryCredit, regularEmployee, regularEmployer, providentEmployee, providentEmployer, employee, employer, ecEmployer, totalRemittance: employee + employer + ecEmployer }
  const cappedBasicSalary = Math.min(10000000, Math.max(1000000, philhealthMonthlyBasicSalary))
  // Equal shares are rounded individually; expose any one-centavo difference from rounding
  // the unsplit premium so it cannot be silently treated as an agency rounding rule.
  const philhealthShare = portion(cappedBasicSalary, 25, 1000), calculatedUnsplitPremium = portion(cappedBasicSalary, 5, 100)
  const philhealth = { cappedBasicSalary, premium: philhealthShare * 2, employee: philhealthShare, employer: philhealthShare, calculatedUnsplitPremium, roundingDifference: philhealthShare * 2 - calculatedUnsplitPremium }
  const cappedFundSalary = Math.min(1000000, pagibigMonthlyFundSalary), employeeRatePercent = pagibigMonthlyFundSalary <= 150000 ? 1 : 2
  const pagibigEmployee = portion(cappedFundSalary, employeeRatePercent, 100), pagibigEmployer = portion(cappedFundSalary, 2, 100)
  const pagibig = { cappedFundSalary, employeeRatePercent, employerRatePercent: 2 as const, employee: pagibigEmployee, employer: pagibigEmployer, totalRemittance: pagibigEmployee + pagibigEmployer }
  const result: MonthlyContributionSuggestion = { ...metadata(reviewNote), basis, periodBasis: 'calendar_month', sss, philhealth, pagibig, monthlyAmounts: { sssEmployee: employee, sssEmployer: employer, ecEmployer, philhealthEmployee: philhealth.employee, philhealthEmployer: philhealth.employer, pagibigEmployee, pagibigEmployer }, sources: [payrollStatutorySources.sss, payrollStatutorySources.philhealth, payrollStatutorySources.philhealth2026, payrollStatutorySources.pagibig, payrollStatutorySources.pagibigEffectivity] }
  result.warnings.push('Monthly totals are not a per-cutoff deduction. Review amounts already deducted and posted for this employee/month before assigning any amount to a payroll period.', 'PhilHealth uses fixed basic salary before absence/late/undertime reductions, excluding commissions, overtime, allowances, 13th-month pay, bonuses and gratuities.', 'Voluntary savings, MP2, loans and arrears are excluded; no automatic gross-to-statutory-base classification is performed.')
  if (philhealth.roundingDifference) result.warnings.push('Equal rounded PhilHealth shares differ by one centavo from rounding the unsplit premium. Confirm the agency-assessed amount and allocation before applying.')
  return result
}
// Each [threshold, fixed tax, rate] is in literal pesos from BIR Annex E, converted below.
// No annual-table conversion: published pay-period constants differ due to rounding.
const withholdingTable: Record<StatutoryFrequency, readonly (readonly [number, number, number])[]> = {
  monthly: [[0, 0, 0], [20833, 0, 15], [33333, 1875, 20], [66667, 8541.80, 25], [166667, 33541.80, 30], [666667, 183541.80, 35]],
  semi_monthly: [[0, 0, 0], [10417, 0, 15], [16667, 937.50, 20], [33333, 4270.70, 25], [83333, 16770.70, 30], [333333, 91770.70, 35]],
  weekly: [[0, 0, 0], [4808, 0, 15], [7692, 432.60, 20], [15385, 1971.20, 25], [38462, 7740.45, 30], [153846, 42355.65, 35]],
  daily: [[0, 0, 0], [685, 0, 15], [1096, 61.65, 20], [2192, 280.85, 25], [5479, 1102.60, 30]],
}
export function suggestCompensationWithholding(value: unknown): CompensationWithholdingSuggestion {
  const v = record(value), reviewNote = review(v), payDate = date(v.payDate)
  if (v.scope !== 'regular_single_employer_period') throw Error('Withholding suggestions cover regular taxable compensation for one employer and one ordinary pay period. Minimum-wage exemptions, special tax classes, supplementary pay, final pay, multiple/prior employers and annualization require manual review.')
  if (typeof v.frequency !== 'string' || !Object.prototype.hasOwnProperty.call(withholdingTable, v.frequency)) throw Error('Use a monthly, semi-monthly, weekly or daily pay frequency; other schedules need manual review.')
  const frequency = v.frequency as StatutoryFrequency, taxableCompensation = amount(v.taxableCompensation, 'Reviewed taxable compensation')
  if (frequency === 'daily' && taxableCompensation >= 2191800) throw Error('Manual review required: the official Annex E daily top-bracket fixed tax is printed ambiguously. Confirm the BIR-prescribed amount for daily taxable compensation of ₱21,918 or more.')
  const rows = withholdingTable[frequency], index = rows.reduce((selected, row, i) => taxableCompensation >= row[0] * 100 ? i : selected, 0)
  const selected = rows[index], threshold = Math.round(selected[0] * 100), fixedTax = Math.round(selected[1] * 100), ratePercent = selected[2], excess = taxableCompensation - threshold
  const basis: CompensationWithholdingInput = { payDate, frequency, scope: 'regular_single_employer_period', basesReviewed: true, reviewNote, taxableCompensation }
  const result: CompensationWithholdingSuggestion = { ...metadata(reviewNote), basis, periodBasis: frequency, bracket: index + 1, threshold, fixedTax, ratePercent, excess, withholdingTax: fixedTax + portion(excess, ratePercent, 100), sources: [payrollStatutorySources.bir] }
  result.warnings.push('Taxable compensation is a separately reviewed input after applicable exclusions and mandatory deductions. This helper does not classify benefits, decide exemption eligibility or compute annual adjustments.', 'This is the ordinary pay-period table. Reconcile previous deductions, supplementary compensation and year-end/final-pay treatment separately.')
  return result
}
