const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const h = require('./helpers/company-harness.cjs')()
const payroll = require('../lib/payroll.js')
const statutory = require('../lib/payroll-statutory.js')
beforeEach(() => h.reset())
const reviewNote = 'Reviewed payroll bases, ordinary employee scope, applicable agency assessments and allocation history.'
const employeeInput = { code: 'EMP-CALC', fullName: 'Reviewed Payroll Employee', tin: '011012013', sssNumber: '', philhealthNumber: '', pagibigNumber: '', address: 'Company employee address', compensationAtc: 'WC010', department: 'Operations', jobTitle: 'Staff', startDate: '2026-01-01', endDate: '', active: true, payFrequency: 'monthly', basicPay: 3000000, notes: '' }
const period = { periodStart: '2026-08-01', periodEnd: '2026-08-31', payDate: '2026-08-31', frequency: 'monthly' }
const contributionInput = changes => ({ contributionMonth: '2026-08', scope: 'ordinary_private_employee_full_month', basesReviewed: true, reviewNote, sssMonthlyCompensation: 3000000, philhealthMonthlyBasicSalary: 3000000, pagibigMonthlyFundSalary: 3000000, ...changes })
const taxInput = changes => ({ payDate: '2026-08-31', frequency: 'monthly', scope: 'regular_single_employer_period', basesReviewed: true, reviewNote, taxableCompensation: 2755000, ...changes })
async function setup() {
  const c = await h.setup(), ledger = h.get(c.companyId, 'accounting/books')
  for (const code of ['2300', '2310', '2320', '2330', '2340']) ledger.books.accounts.push({ code, name: `Payroll ${code}`, type: 'Liability', cash: false })
  const result = await h.call('companyPayroll', 'accountant', { action: 'saveEmployee', input: employeeInput, expectedRevision: 0 })
  return { ...c, employee: h.get(c.companyId, 'employees/default').employees.find(row => row.id === result.id) }
}
function input(employee, changes = {}) {
  let row = payroll.applyMonthlyPayrollSuggestion(payroll.blankPayrollRow(employee), employee, period, statutory.suggestMonthlyContributions(contributionInput()), true, false)
  row = payroll.applyPayrollWithholdingSuggestion(row, employee, period, statutory.suggestCompensationWithholding(taxInput()))
  return { reference: 'PAY-CALC-AUG', ...period, rows: [row], accounts: { ...payroll.emptyPayrollAccounts, salaryExpense: '5200', employerExpense: '5900', netPayable: '2300', sssPayable: '2310', philhealthPayable: '2320', pagibigPayable: '2330', withholdingPayable: '2340' }, calculationsReviewed: true, calculationNote: reviewNote, ...changes }
}
const save = value => h.call('companyPayroll', 'accountant', { action: 'saveRun', input: value, expectedRevision: 0, expectedEmployeeRevision: 1 })
const approve = (run, expectedBooksRevision = 0) => h.call('companyPayroll', 'manager', { action: 'approveRun', id: run.id, expectedRevision: run.version, expectedBooksRevision, reviewNote: 'Independently checked saved statutory bases, prior allocations and payroll posting accounts.' })

test('server stores recalculated evidence and rejects a preparer approving their own calculated payroll', async () => {
  const { companyId, employee } = await setup(), value = input(employee)
  value.rows[0].statutoryEvidence.monthly.suggestion.sources = [{ url: 'https://untrusted.example', title: 'Fake' }]
  value.rows[0].statutoryEvidence.monthly.suggestion.sss.employee = 1
  value.rows[0].statutoryEvidence.withholding.suggestion.withholdingTax = 1
  value.rows[0].statutoryEvidence.withholding.suggestion.verifiedOn = '2099-01-01'
  const run = await save(value), stored = h.get(companyId, `payrollRuns/${run.id}`)
  assert.equal(stored.rows[0].sssEmployee, 150000)
  assert.equal(stored.rows[0].statutoryEvidence.monthly.suggestion.sss.employee, 150000)
  assert.equal(stored.rows[0].statutoryEvidence.monthly.suggestion.sources.some(source => source.url.includes('untrusted')), false)
  assert.equal(stored.rows[0].statutoryEvidence.withholding.suggestion.verifiedOn, '2026-09-17')
  assert.equal(stored.rows[0].withholdingTax, 100755)
  await assert.rejects(h.call('companyPayroll', 'accountant', { action: 'approveRun', id: run.id, expectedRevision: 1, expectedBooksRevision: 0, reviewNote }), { code: 'permission-denied' })
  await approve(run)
  const tax = h.get(companyId, 'taxRegisters/default').records[0]
  assert.equal(tax.taxBase, 2755000); assert.equal(tax.taxAmount, 100755)
  assert.equal(h.get(companyId, 'accounting/books').books.entries[0].lines.reduce((sum, line) => sum + line.debit - line.credit, 0), 0)
  assert.equal((await approve(run)).alreadyPosted, true)
})
test('monthly application requires a full calendar month, full employment, matching month and explicit allocation acknowledgement', async () => {
  const { employee } = await setup(), row = payroll.blankPayrollRow(employee), suggestion = statutory.suggestMonthlyContributions(contributionInput())
  for (const changed of [{ frequency: 'semi_monthly' }, { periodStart: '2026-08-02' }, { periodEnd: '2026-08-30' }]) assert.throws(() => payroll.applyMonthlyPayrollSuggestion(row, employee, { ...period, ...changed }, suggestion, true, false), /complete calendar-month/)
  assert.throws(() => payroll.applyMonthlyPayrollSuggestion(row, { ...employee, startDate: '2026-08-15' }, period, suggestion, true, false), /not employed for the full/)
  assert.throws(() => payroll.applyMonthlyPayrollSuggestion(row, employee, period, suggestion, false, false), /already been allocated/)
  assert.throws(() => payroll.applyMonthlyPayrollSuggestion(row, employee, { ...period, periodStart: '2026-07-01', periodEnd: '2026-07-31' }, suggestion, true, false), /month must match/)
})
test('PhilHealth centavo discrepancy cannot be applied without a separate assessment confirmation', async () => {
  const { employee } = await setup(), row = payroll.blankPayrollRow(employee), suggestion = statutory.suggestMonthlyContributions(contributionInput({ philhealthMonthlyBasicSalary: 1000020 }))
  assert.equal(suggestion.philhealth.roundingDifference, 1)
  assert.throws(() => payroll.applyMonthlyPayrollSuggestion(row, employee, period, suggestion, true, false), /PhilHealth assessment/)
  const applied = payroll.applyMonthlyPayrollSuggestion(row, employee, period, suggestion, true, true)
  assert.equal(applied.philhealthEmployee, 25001)
  const run = await save(input(employee, { rows: [applied] }))
  assert.ok(run.id)
})
test('edited amount, earnings, pay date, frequency, employee version or table version invalidates attached calculations', async () => {
  const { companyId, employee } = await setup()
  const mutations = [
    v => { v.rows[0].sssEmployee++ },
    v => { v.rows[0].basicPay++ },
    v => { v.rows[0].withholdingTax++ },
    v => { v.rows[0].taxableCompensation++ },
    v => { v.payDate = '2026-09-01' },
    v => { v.rows[0].statutoryEvidence.monthly.context.employeeVersion++ },
    v => { v.rows[0].statutoryEvidence.monthly.suggestion.version = 'old-rates' },
  ]
  for (const mutate of mutations) { const value = input(employee); mutate(value); await assert.rejects(save(value), { code: 'invalid-argument' }) }
  assert.equal(h.get(companyId, 'accounting/books').revision, 0)
  assert.equal([...h.documents.keys()].filter(path => path.startsWith(`companies/${companyId}/payrollRuns/`)).length, 0)
})
test('applying monthly contributions clears prior withholding evidence and later deduction changes require taxable-pay review', async () => {
  const { employee } = await setup(), tax = statutory.suggestCompensationWithholding(taxInput())
  let row = payroll.applyPayrollWithholdingSuggestion(payroll.blankPayrollRow(employee), employee, period, tax)
  row = payroll.applyMonthlyPayrollSuggestion(row, employee, period, statutory.suggestMonthlyContributions(contributionInput()), true, false)
  assert.equal(row.statutoryEvidence.withholding, undefined)
  row = payroll.applyPayrollWithholdingSuggestion(row, employee, period, tax)
  delete row.statutoryEvidence.monthly
  row.philhealthEmployee++
  await assert.rejects(save(input(employee, { rows: [row] })), /Mandatory deductions changed/)
})
test('approval recomputes a saved calculation and cannot post tampered amounts or keep forged evidence', async () => {
  const { companyId, employee } = await setup(), run = await save(input(employee)), stored = h.get(companyId, `payrollRuns/${run.id}`)
  stored.rows[0].sssEmployer++
  await assert.rejects(approve(run), /no longer matches/)
  assert.equal(h.get(companyId, 'accounting/books').revision, 0)
  assert.equal(h.get(companyId, 'taxRegisters/default'), undefined)
  stored.rows[0].sssEmployer--
  stored.rows[0].statutoryEvidence.monthly.suggestion.sources = []
  await approve(run)
  assert.ok(h.get(companyId, `payrollRuns/${run.id}`).rows[0].statutoryEvidence.monthly.suggestion.sources.length > 0)
})
test('another posted payroll paid during the month blocks full-month calculator application even when periods do not overlap', async () => {
  const { companyId, employee } = await setup(), value = input(employee)
  const row = { ...value.rows[0] }; delete row.statutoryEvidence
  const previous = await save({ ...value, rows: [row], reference: 'JULY-PAID-AUGUST', periodStart: '2026-07-01', periodEnd: '2026-07-31', payDate: '2026-08-05' })
  await approve(previous)
  await assert.rejects(save(value), /another posted payroll/)
  assert.equal(h.get(companyId, 'accounting/books').revision, 1)
})
test('two drafts can be prepared but only one monthly allocation can be approved', async () => {
  const { companyId, employee } = await setup(), first = await save(input(employee)), second = await save(input(employee, { reference: 'SECOND-ALLOCATION' }))
  await approve(first)
  await assert.rejects(approve(second, 1), /another posted payroll/)
  assert.equal(h.get(companyId, 'accounting/books').books.entries.length, 1)
  assert.equal(h.get(companyId, `payrollRuns/${second.id}`).status, 'draft')
})
test('separate withholding supports semi-monthly payroll without inventing monthly contribution allocations', async () => {
  const { companyId, employee } = await setup(), current = h.get(companyId, 'employees/default').employees[0]
  current.payFrequency = 'semi_monthly'
  const p = { periodStart: '2026-08-01', periodEnd: '2026-08-15', payDate: '2026-08-15', frequency: 'semi_monthly' }, row = payroll.applyPayrollWithholdingSuggestion(payroll.blankPayrollRow(current), current, p, statutory.suggestCompensationWithholding(taxInput({ payDate: p.payDate, frequency: p.frequency, taxableCompensation: 1400000 })))
  const value = input(employee); Object.assign(value, p, { rows: [row] })
  const run = await save(value)
  assert.equal(row.withholdingTax, 53745)
  assert.equal(row.sssEmployee, 0)
  assert.equal(row.statutoryEvidence.monthly, undefined)
  await approve(run)
  assert.equal(h.get(companyId, 'taxRegisters/default').records[0].taxAmount, 53745)
})
test('manual payroll remains available after deliberately removing calculation evidence', async () => {
  const { companyId, employee } = await setup(), value = input(employee)
  delete value.rows[0].statutoryEvidence
  value.rows[0].sssEmployee = 123456
  value.calculationNote = 'Manual correction reviewed against payroll records; helper evidence removed before adjusting amounts.'
  const run = await save(value)
  assert.equal(h.get(companyId, `payrollRuns/${run.id}`).rows[0].statutoryEvidence, undefined)
  await approve(run)
})
