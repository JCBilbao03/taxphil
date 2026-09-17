import assert from 'node:assert/strict'
import test from 'node:test'
import { blankPayrollRow, calculatePayrollRun, emptyPayrollAccounts, payrollJournal, payrollOverlaps, validateEmployee } from '../src/lib/payroll.ts'

const employee = () => validateEmployee({ code: 'EMP-001', fullName: 'Sample Employee', tin: '001-002-003', sssNumber: '', philhealthNumber: '', pagibigNumber: '', address: 'Sample registered address', compensationAtc: 'WC010', jobTitle: 'Sample role', department: 'Operations', startDate: '2026-01-01', endDate: '', active: true, payFrequency: 'monthly', basicPay: 3000000, notes: '' }, 'employee-1', 1)
const chart = [{ code: '5200', type: 'Expense' }, { code: '5900', type: 'Expense' }, ...['2300', '2310', '2320', '2330', '2340', '2350', '2360'].map(code => ({ code, type: 'Liability' }))]
function fixture() {
  const row = { ...blankPayrollRow(employee()), sssEmployee: 150000, sssEmployer: 300000, ecEmployer: 3000, philhealthEmployee: 75000, philhealthEmployer: 75000, pagibigEmployee: 20000, pagibigEmployer: 20000, withholdingTax: 80000, taxableCompensation: 2755000 }
  return { reference: 'PAY-2026-09', periodStart: '2026-09-01', periodEnd: '2026-09-30', payDate: '2026-09-30', frequency: 'monthly', rows: [row], accounts: { ...emptyPayrollAccounts, salaryExpense: '5200', employerExpense: '5900', netPayable: '2300', sssPayable: '2310', philhealthPayable: '2320', pagibigPayable: '2330', withholdingPayable: '2340', loansPayable: '2350', otherPayable: '2360' }, calculationsReviewed: true, calculationNote: 'Illustrative manual amounts supplied for arithmetic tests only; these are not statutory calculation expectations.' }
}
test('employee identifiers preserve leading zeros and enforce required TIN and reviewed ATC', () => {
  assert.equal(employee().tin, '001002003')
  assert.throws(() => validateEmployee({ ...employee(), tin: '' }, 'employee-1', 2))
  assert.throws(() => validateEmployee({ ...employee(), compensationAtc: '' }, 'employee-1', 2))
  assert.throws(() => validateEmployee({ ...employee(), sssNumber: '123' }, 'employee-1', 2))
})
test('payroll independently totals net pay and employer cost using integer centavos', () => {
  const run = calculatePayrollRun(fixture(), [employee()], 3)
  assert.deepEqual(run.totals, { grossPay: 3000000, deductions: 325000, netPay: 2675000, employerContributions: 398000, totalCost: 3398000 })
  assert.equal(run.employeeRevision, 3)
  assert.equal(run.rows[0].employee.version, 1)
})
test('payroll journal balances and routes both contribution shares to liabilities', () => {
  const lines = payrollJournal(calculatePayrollRun(fixture(), [employee()], 3), chart)
  assert.equal(lines.reduce((sum, line) => sum + line.debit - line.credit, 0), 0)
  assert.equal(lines.find(line => line.account === '2310')?.credit, 453000)
  assert.equal(lines.find(line => line.account === '2300')?.credit, 2675000)
  assert.equal(lines.find(line => line.account === '5900')?.debit, 398000)
})
test('payroll refuses unsupported amounts and deduction overdraws', () => {
  const input = fixture()
  assert.throws(() => calculatePayrollRun({ ...input, rows: [{ ...input.rows[0], basicPay: 1.5 }] }, [employee()], 1))
  assert.throws(() => calculatePayrollRun({ ...input, rows: [{ ...input.rows[0], otherDeductions: 4000000 }] }, [employee()], 1))
  assert.throws(() => calculatePayrollRun({ ...input, rows: [{ ...input.rows[0], taxableCompensation: 4000000 }] }, [employee()], 1))
})
test('payroll rejects duplicate or inactive employees, wrong frequency, and dates', () => {
  const input = fixture()
  assert.throws(() => calculatePayrollRun({ ...input, rows: [input.rows[0], input.rows[0]] }, [employee()], 1))
  assert.throws(() => calculatePayrollRun(input, [{ ...employee(), active: false }], 1))
  assert.throws(() => calculatePayrollRun({ ...input, frequency: 'weekly' }, [employee()], 1))
  assert.throws(() => calculatePayrollRun({ ...input, periodStart: '2026-02-30' }, [employee()], 1))
  assert.throws(() => calculatePayrollRun({ ...input, payDate: '2026-09-01' }, [employee()], 1))
})
test('posting requires documented calculation review and valid non-control accounts', () => {
  const input = fixture()
  assert.throws(() => payrollJournal(calculatePayrollRun({ ...input, calculationsReviewed: false }, [employee()], 1), chart))
  assert.throws(() => payrollJournal(calculatePayrollRun({ ...input, calculationNote: '' }, [employee()], 1), chart))
  assert.throws(() => payrollJournal(calculatePayrollRun({ ...input, accounts: { ...input.accounts, netPayable: '5200' } }, [employee()], 1), chart))
  assert.throws(() => payrollJournal(calculatePayrollRun({ ...input, accounts: { ...input.accounts, netPayable: '2000' } }, [employee()], 1), [...chart, { code: '2000', type: 'Liability' }]))
})
test('overlap detection includes partial periods and only common employees', () => {
  const run = calculatePayrollRun(fixture(), [employee()], 1)
  assert.equal(payrollOverlaps(run, { ...run, periodStart: '2026-09-15', periodEnd: '2026-10-14' }), true)
  assert.equal(payrollOverlaps(run, { ...run, periodStart: '2026-10-01', periodEnd: '2026-10-31' }), false)
  assert.equal(payrollOverlaps(run, { ...run, rows: [{ ...run.rows[0], employeeId: 'other' }] }), false)
})
