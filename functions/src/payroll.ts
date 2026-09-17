import { payrollStatutoryVersion, suggestMonthlyContributions, suggestCompensationWithholding, type MonthlyContributionSuggestion, type CompensationWithholdingSuggestion } from './payroll-statutory.js'
export type PayrollFrequency = 'monthly' | 'semi_monthly' | 'weekly' | 'daily'
export interface EmployeeRecord {
  id: string; code: string; fullName: string; tin: string; sssNumber: string; philhealthNumber: string; pagibigNumber: string
  address: string; compensationAtc: string; jobTitle: string; department: string; startDate: string; endDate: string; active: boolean; payFrequency: PayrollFrequency; basicPay: number; notes: string; version: number
}
export const payrollEarnings = ['basicPay', 'overtimePay', 'holidayPay', 'allowances', 'bonus', 'nonTaxableEarnings'] as const
export const payrollDeductions = ['sssEmployee', 'philhealthEmployee', 'pagibigEmployee', 'withholdingTax', 'loanDeductions', 'otherDeductions'] as const
export const payrollEmployerCosts = ['sssEmployer', 'philhealthEmployer', 'pagibigEmployer', 'ecEmployer'] as const
export const payrollAmountFields = [...payrollEarnings, 'absenceDeduction', ...payrollDeductions, ...payrollEmployerCosts, 'taxableCompensation'] as const
export type PayrollAmountField = typeof payrollAmountFields[number]
export const payrollFieldLabels: Record<PayrollAmountField, string> = {
  basicPay: 'Basic pay', overtimePay: 'Overtime pay', holidayPay: 'Holiday pay', allowances: 'Allowances', bonus: 'Bonus / other earnings', nonTaxableEarnings: 'Non-taxable earnings', absenceDeduction: 'Unpaid time / earnings reduction',
  sssEmployee: 'SSS employee share', philhealthEmployee: 'PhilHealth employee share', pagibigEmployee: 'Pag-IBIG employee share', withholdingTax: 'Compensation withholding tax', loanDeductions: 'Loan deductions', otherDeductions: 'Other deductions',
  sssEmployer: 'SSS employer share', philhealthEmployer: 'PhilHealth employer share', pagibigEmployer: 'Pag-IBIG employer share', ecEmployer: 'Employees’ compensation (EC)', taxableCompensation: 'Reviewed taxable compensation',
}
export type PayrollRowInput = Record<PayrollAmountField, number> & { employeeId: string; note: string; statutoryEvidence?: PayrollStatutoryEvidence }
export type PayrollRow = PayrollRowInput & { employee: EmployeeRecord; grossPay: number; totalDeductions: number; netPay: number; employerContributions: number }
export interface PayrollAccounts { salaryExpense: string; employerExpense: string; netPayable: string; sssPayable: string; philhealthPayable: string; pagibigPayable: string; withholdingPayable: string; loansPayable: string; otherPayable: string }
export const payrollAccountLabels: Record<keyof PayrollAccounts, string> = { salaryExpense: 'Salary expense', employerExpense: 'Employer contribution expense', netPayable: 'Net salaries payable', sssPayable: 'SSS and EC payable', philhealthPayable: 'PhilHealth payable', pagibigPayable: 'Pag-IBIG payable', withholdingPayable: 'Compensation tax payable', loansPayable: 'Payroll loan deductions payable', otherPayable: 'Other payroll deductions payable' }
export const emptyPayrollAccounts: PayrollAccounts = { salaryExpense: '', employerExpense: '', netPayable: '', sssPayable: '', philhealthPayable: '', pagibigPayable: '', withholdingPayable: '', loansPayable: '', otherPayable: '' }
export interface PayrollRunInput { reference: string; periodStart: string; periodEnd: string; payDate: string; frequency: PayrollFrequency; rows: PayrollRowInput[]; accounts: PayrollAccounts; calculationsReviewed: boolean; calculationNote: string }
export interface PayrollRun extends Omit<PayrollRunInput, 'rows'> { rows: PayrollRow[]; totals: { grossPay: number; deductions: number; netPay: number; employerContributions: number; totalCost: number }; employeeRevision: number }
export const payrollSources = [
  { agency: 'BIR', title: 'Compensation withholding tax tables (2023 onwards)', url: 'https://bir-cdn.bir.gov.ph/local/pdf/Annex%20E%20RR%2011-2018.pdf' },
  { agency: 'SSS', title: 'Contribution tables and payment guidance', url: 'https://www.sss.gov.ph/pay-contribution/' },
  { agency: 'PhilHealth', title: 'Employer contribution guidance', url: 'https://www.philhealth.gov.ph/partners/employers/' },
  { agency: 'Pag-IBIG', title: 'Official employer and membership guidance', url: 'https://www.pagibigfund.gov.ph/' },
]
const record = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Enter a valid payroll record.'); return value as Record<string, unknown> }
const text = (value: unknown, label: string, max = 200, optional = false) => { if (optional && (value === '' || value === undefined)) return ''; if (typeof value !== 'string' || !value.trim() || value.length > max) throw Error(`${label} is required (maximum ${max} characters).`); return value.trim() }
export const payrollDate = (value: unknown, label: string) => { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw Error(`Enter a valid ${label}.`); return value }
export const payrollCentavos = (value: unknown, label: string) => { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 1e10) throw Error(`${label} must be a non-negative whole number of centavos, up to ₱100 million.`); return value }
const frequency = (value: unknown): PayrollFrequency => { if (!['monthly', 'semi_monthly', 'weekly', 'daily'].includes(String(value))) throw Error('Choose a valid pay frequency.'); return value as PayrollFrequency }
const governmentId = (value: unknown, label: string, length: number, required = false) => { const raw = text(value, label, 30, !required).replace(/[\s-]/g, ''); if ((required || raw) && !new RegExp(`^\\d{${length}}$`).test(raw)) throw Error(`${label} must contain ${length} digits.`); return raw }
export function validateEmployee(value: unknown, id: string, version: number): EmployeeRecord {
  const v = record(value)
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw Error('Invalid employee ID.')
  if (typeof v.active !== 'boolean') throw Error('Choose the employee’s active status.')
  const startDate = payrollDate(v.startDate, 'start date'), endDate = v.endDate ? payrollDate(v.endDate, 'end date') : ''
  if (endDate && endDate < startDate) throw Error('The end date must be on or after the start date.')
  const code = text(v.code, 'Employee code', 30).toUpperCase()
  const compensationAtc = text(v.compensationAtc, 'Reviewed compensation ATC', 10).toUpperCase()
  if (!/^WC\d{3}$/.test(compensationAtc)) throw Error('Enter the reviewed compensation ATC (WC followed by three digits).')
  if (!/^[A-Z0-9_-]+$/.test(code)) throw Error('Use letters, numbers, hyphens, or underscores for the employee code.')
  return { id, version, code, fullName: text(v.fullName, 'Employee name', 150), tin: governmentId(v.tin, 'Employee TIN', 9, true), sssNumber: governmentId(v.sssNumber, 'SSS number', 10), philhealthNumber: governmentId(v.philhealthNumber, 'PhilHealth number', 12), pagibigNumber: governmentId(v.pagibigNumber, 'Pag-IBIG MID number', 12), address: text(v.address, 'Employee registered address', 500), compensationAtc, jobTitle: text(v.jobTitle, 'Job title', 120, true), department: text(v.department, 'Department', 120, true), startDate, endDate, active: v.active, payFrequency: frequency(v.payFrequency), basicPay: payrollCentavos(v.basicPay, 'Basic pay per period'), notes: text(v.notes, 'Employee notes', 1000, true) }
}
export function blankPayrollRow(employee: EmployeeRecord): PayrollRowInput { return { ...Object.fromEntries(payrollAmountFields.map(key => [key, key === 'basicPay' ? employee.basicPay : 0])), employeeId: employee.id, note: '' } as PayrollRowInput }
export function calculatePayrollRun(value: unknown, employees: EmployeeRecord[], employeeRevision: number): PayrollRun {
  const v = record(value), periodStart = payrollDate(v.periodStart, 'period start'), periodEnd = payrollDate(v.periodEnd, 'period end'), payDate = payrollDate(v.payDate, 'pay date')
  if (periodEnd < periodStart || (Date.parse(periodEnd) - Date.parse(periodStart)) / 86400000 > 62) throw Error('A payroll period must run from its start through its end, for at most 63 days.')
  if (payDate < periodEnd) throw Error('The pay date must be on or after the period end.')
  const payFrequency = frequency(v.frequency)
  if (!Array.isArray(v.rows) || !v.rows.length || v.rows.length > 100) throw Error('Include 1–100 employees in a payroll run.')
  if (typeof v.calculationsReviewed !== 'boolean') throw Error('Specify whether payroll calculations have been reviewed.')
  const seen = new Set<string>()
  const rows = v.rows.map(raw => {
    const item = record(raw), employeeId = text(item.employeeId, 'Employee ID', 80)
    if (seen.has(employeeId)) throw Error('Each employee can appear only once in a payroll run.'); seen.add(employeeId)
    const employee = employees.find(row => row.id === employeeId)
    if (!employee || !employee.active) throw Error('Select an active employee for every payroll row.')
    if (employee.startDate > periodEnd || (employee.endDate && employee.endDate < periodStart)) throw Error(`${employee.code} was not employed during this period.`)
    if (employee.payFrequency !== payFrequency) throw Error(`${employee.code} has a different pay frequency.`)
    const clean = Object.fromEntries(payrollAmountFields.map(key => [key, payrollCentavos(item[key], payrollFieldLabels[key])])) as Record<PayrollAmountField, number>
    const grossPay = payrollEarnings.reduce((total, key) => total + clean[key], 0) - clean.absenceDeduction
    const totalDeductions = payrollDeductions.reduce((total, key) => total + clean[key], 0), netPay = grossPay - totalDeductions
    if (grossPay < 0 || netPay < 0) throw Error(`${employee.code}: earnings reductions or deductions exceed the available pay.`)
    if (clean.taxableCompensation > grossPay) throw Error(`${employee.code}: taxable compensation cannot exceed gross pay.`)
    const employerContributions = payrollEmployerCosts.reduce((total, key) => total + clean[key], 0)
    const statutoryEvidence = item.statutoryEvidence === undefined ? undefined : validatePayrollStatutoryEvidence(item.statutoryEvidence, { ...clean, employeeId, note: '' }, employee, { periodStart, periodEnd, payDate, frequency: payFrequency })
    return { ...clean, ...(statutoryEvidence ? { statutoryEvidence } : {}), employeeId, note: text(item.note, 'Employee payroll note', 1000, true), employee: { ...employee }, grossPay, totalDeductions, netPay, employerContributions }
  })
  const total = (field: 'grossPay' | 'totalDeductions' | 'netPay' | 'employerContributions') => rows.reduce((sum, row) => sum + row[field], 0)
  const totals = { grossPay: total('grossPay'), deductions: total('totalDeductions'), netPay: total('netPay'), employerContributions: total('employerContributions'), totalCost: total('grossPay') + total('employerContributions') }
  if (totals.totalCost <= 0 || totals.totalCost > 1e12) throw Error('Payroll cost must be positive and no more than ₱10 billion.')
  const rawAccounts = record(v.accounts), accounts = Object.fromEntries(Object.keys(emptyPayrollAccounts).map(key => [key, text(rawAccounts[key], payrollAccountLabels[key as keyof PayrollAccounts], 30, true)])) as unknown as PayrollAccounts
  return { reference: text(v.reference, 'Payroll reference', 100), periodStart, periodEnd, payDate, frequency: payFrequency, rows, accounts, calculationsReviewed: v.calculationsReviewed, calculationNote: text(v.calculationNote, 'Calculation / review notes', 3000, true), totals, employeeRevision }
}
export function payrollJournal(run: PayrollRun, chart: { code: string; type: string }[]) {
  if (!run.calculationsReviewed || !run.calculationNote.trim()) throw Error('Confirm the calculation review and document the rates, bases, period allocation, and adjustments before posting.')
  const sum = (field: PayrollAmountField) => run.rows.reduce((total, row) => total + row[field], 0)
  const allocation: [keyof PayrollAccounts, number, number][] = [
    ['salaryExpense', run.totals.grossPay, 0], ['employerExpense', run.totals.employerContributions, 0], ['netPayable', 0, run.totals.netPay],
    ['sssPayable', 0, sum('sssEmployee') + sum('sssEmployer') + sum('ecEmployer')], ['philhealthPayable', 0, sum('philhealthEmployee') + sum('philhealthEmployer')], ['pagibigPayable', 0, sum('pagibigEmployee') + sum('pagibigEmployer')], ['withholdingPayable', 0, sum('withholdingTax')], ['loansPayable', 0, sum('loanDeductions')], ['otherPayable', 0, sum('otherDeductions')],
  ]
  const grouped = new Map<string, { account: string; debit: number; credit: number }>()
  for (const [key, debit, credit] of allocation) {
    if (!debit && !credit) continue
    const account = chart.find(row => row.code === run.accounts[key]), expected = key === 'salaryExpense' || key === 'employerExpense' ? 'Expense' : 'Liability'
    if (!account || account.type !== expected || ['1100', '2000', '2110'].includes(account.code)) throw Error(`Choose a valid ${expected.toLowerCase()} account for ${payrollAccountLabels[key]}.`)
    const previous = grouped.get(account.code) || { account: account.code, debit: 0, credit: 0 }
    grouped.set(account.code, { account: account.code, debit: previous.debit + debit, credit: previous.credit + credit })
  }
  const lines = [...grouped.values()]
  if (lines.reduce((sum, row) => sum + row.debit - row.credit, 0) !== 0) throw Error('The payroll journal does not balance.')
  return lines
}
export function payrollOverlaps(a: Pick<PayrollRun, 'periodStart' | 'periodEnd' | 'rows'>, b: Pick<PayrollRun, 'periodStart' | 'periodEnd' | 'rows'>) {
  return a.periodStart <= b.periodEnd && b.periodStart <= a.periodEnd && a.rows.some(row => b.rows.some(other => other.employeeId === row.employeeId))
}

export type PayrollPeriodContext = Pick<PayrollRunInput, 'periodStart' | 'periodEnd' | 'payDate' | 'frequency'>
export const payrollMonthlyContributionFields = ['sssEmployee', 'sssEmployer', 'ecEmployer', 'philhealthEmployee', 'philhealthEmployer', 'pagibigEmployee', 'pagibigEmployer'] as const
const evidenceEarningsFields = [...payrollEarnings, 'absenceDeduction'] as const
const evidenceDeductionFields = ['sssEmployee', 'philhealthEmployee', 'pagibigEmployee'] as const
interface PayrollEvidenceContext extends PayrollPeriodContext { employeeId: string; employeeVersion: number; earnings: Record<typeof evidenceEarningsFields[number], number> }
export interface PayrollStatutoryEvidence {
  monthly?: { context: PayrollEvidenceContext; suggestion: MonthlyContributionSuggestion; noOtherAllocationConfirmed: true; roundingConfirmed: boolean }
  withholding?: { context: PayrollEvidenceContext; suggestion: CompensationWithholdingSuggestion; deductions: Record<typeof evidenceDeductionFields[number], number> }
}
const evidenceContext = (row: PayrollRowInput, employee: EmployeeRecord, period: PayrollPeriodContext): PayrollEvidenceContext => ({ ...period, employeeId: employee.id, employeeVersion: employee.version, earnings: Object.fromEntries(evidenceEarningsFields.map(key => [key, row[key]])) as PayrollEvidenceContext['earnings'] })
export function payrollFullContributionMonth(period: PayrollPeriodContext, employee: EmployeeRecord) {
  const start = payrollDate(period.periodStart, 'period start'), end = payrollDate(period.periodEnd, 'period end')
  const month = start.slice(0, 7), last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).toISOString().slice(0, 10)
  if (period.frequency !== 'monthly' || start !== `${month}-01` || end !== last) throw Error('Apply monthly contribution suggestions only to one complete calendar-month payroll. Review and allocate other cutoffs manually.')
  if (employee.startDate > start || (employee.endDate && employee.endDate < end)) throw Error('This employee was not employed for the full contribution month. Calculate partial-month contributions manually.')
  return month
}
function checkEvidenceContext(value: unknown, row: PayrollRowInput, employee: EmployeeRecord, period: PayrollPeriodContext) {
  const supplied = record(value), expected = evidenceContext(row, employee, period)
  for (const key of ['periodStart', 'periodEnd', 'payDate', 'frequency', 'employeeId', 'employeeVersion'] as const) if (supplied[key] !== expected[key]) throw Error('The payroll dates, employee or pay frequency changed after calculation. Recalculate or remove the saved statutory evidence for manual review.')
  const earnings = record(supplied.earnings)
  for (const key of evidenceEarningsFields) if (earnings[key] !== row[key]) throw Error('Earnings changed after the statutory calculation. Recalculate the reviewed bases before saving, or remove the evidence for manual review.')
  return expected
}
export function applyMonthlyPayrollSuggestion(row: PayrollRowInput, employee: EmployeeRecord, period: PayrollPeriodContext, supplied: MonthlyContributionSuggestion, noOtherAllocationConfirmed: boolean, roundingConfirmed: boolean): PayrollRowInput {
  if (supplied.version !== payrollStatutoryVersion) throw Error('This calculation uses an older table snapshot. Calculate the suggestion again.')
  const suggestion = suggestMonthlyContributions(supplied.basis)
  if (suggestion.basis.contributionMonth !== payrollFullContributionMonth(period, employee)) throw Error('The contribution month must match the full payroll period.')
  if (!noOtherAllocationConfirmed) throw Error('Confirm that none of these monthly contributions has already been allocated, deducted or remitted for this employee, including outside this system.')
  if (suggestion.philhealth.roundingDifference && !roundingConfirmed) throw Error('Confirm the PhilHealth assessment and equal-share centavo rounding before applying this suggestion.')
  const result = { ...row, ...suggestion.monthlyAmounts }
  // Contributions affect taxable compensation review. A previous withholding preview
  // must not silently retain its evidence when the deductions are replaced.
  result.statutoryEvidence = { monthly: { context: evidenceContext(result, employee, period), suggestion, noOtherAllocationConfirmed: true, roundingConfirmed: Boolean(roundingConfirmed) } }
  return result
}
export function applyPayrollWithholdingSuggestion(row: PayrollRowInput, employee: EmployeeRecord, period: PayrollPeriodContext, supplied: CompensationWithholdingSuggestion): PayrollRowInput {
  if (supplied.version !== payrollStatutoryVersion) throw Error('This calculation uses an older table snapshot. Calculate the suggestion again.')
  const suggestion = suggestCompensationWithholding(supplied.basis)
  if (suggestion.basis.payDate !== period.payDate || suggestion.basis.frequency !== period.frequency) throw Error('The withholding calculation must match the payroll pay date and frequency.')
  const result = { ...row, taxableCompensation: suggestion.basis.taxableCompensation, withholdingTax: suggestion.withholdingTax }
  result.statutoryEvidence = { ...row.statutoryEvidence, withholding: { context: evidenceContext(result, employee, period), suggestion, deductions: Object.fromEntries(evidenceDeductionFields.map(key => [key, result[key]])) as NonNullable<PayrollStatutoryEvidence['withholding']>['deductions'] } }
  return result
}
/** Rebuild canonical calculation evidence on the server; client sources/totals are not trusted. */
export function validatePayrollStatutoryEvidence(value: unknown, row: PayrollRowInput, employee: EmployeeRecord, period: PayrollPeriodContext): PayrollStatutoryEvidence {
  const input = record(value), result: PayrollStatutoryEvidence = {}
  if (input.monthly !== undefined) {
    const monthly = record(input.monthly), supplied = record(monthly.suggestion)
    checkEvidenceContext(monthly.context, row, employee, period)
    const calculated = applyMonthlyPayrollSuggestion(row, employee, period, supplied as unknown as MonthlyContributionSuggestion, monthly.noOtherAllocationConfirmed === true, monthly.roundingConfirmed === true)
    for (const key of payrollMonthlyContributionFields) if (row[key] !== calculated[key]) throw Error(`The saved ${payrollFieldLabels[key]} no longer matches its statutory calculation. Recalculate or remove the evidence before entering a manual adjustment.`)
    result.monthly = calculated.statutoryEvidence!.monthly
  }
  if (input.withholding !== undefined) {
    const withholding = record(input.withholding), supplied = record(withholding.suggestion), deductions = record(withholding.deductions)
    checkEvidenceContext(withholding.context, row, employee, period)
    for (const key of evidenceDeductionFields) if (deductions[key] !== row[key]) throw Error('Mandatory deductions changed after the withholding calculation. Review taxable compensation and recalculate, or remove the evidence for manual review.')
    const calculated = applyPayrollWithholdingSuggestion(row, employee, period, supplied as unknown as CompensationWithholdingSuggestion)
    if (row.taxableCompensation !== calculated.taxableCompensation || row.withholdingTax !== calculated.withholdingTax) throw Error('Taxable compensation or withholding changed after calculation. Recalculate or remove the evidence before entering a manual adjustment.')
    result.withholding = calculated.statutoryEvidence!.withholding
  }
  if (!result.monthly && !result.withholding) throw Error('Saved statutory evidence must contain a reviewed calculation.')
  return result
}
/** Called at draft save and approval; external payroll allocations are also explicitly attested. */
export function assertPayrollContributionAllocation(run: PayrollRun, postedRuns: PayrollRun[]) {
  for (const row of run.rows) {
    const month = row.statutoryEvidence?.monthly?.suggestion.basis.contributionMonth
    if (!month) continue
    const start = `${month}-01`, end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).toISOString().slice(0, 10)
    const prior = postedRuns.find(other => other.rows.some(item => item.employeeId === row.employeeId) && ((other.periodStart <= end && other.periodEnd >= start) || other.payDate.slice(0, 7) === month || other.rows.some(item => item.employeeId === row.employeeId && item.statutoryEvidence?.monthly?.suggestion.basis.contributionMonth === month)))
    if (prior) throw Error(`${row.employee.code}: another posted payroll (${prior.reference}) covers or was paid in this contribution month. Reconcile its allocations and use reviewed manual contribution amounts.`)
  }
}
