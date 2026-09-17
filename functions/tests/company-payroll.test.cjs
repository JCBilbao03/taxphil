const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const h = require('./helpers/company-harness.cjs')()
const { blankPayrollRow, emptyPayrollAccounts } = require('../lib/payroll.js')
beforeEach(() => h.reset())
const employeeInput = { code: 'EMP-001', fullName: 'Sample Employee', tin: '001002003', sssNumber: '', philhealthNumber: '', pagibigNumber: '', address: 'Sample address', compensationAtc: 'WC010', department: 'Operations', jobTitle: 'Staff', startDate: '2026-01-01', endDate: '', active: true, payFrequency: 'monthly', basicPay: 3000000, notes: '' }
async function setup() {
  const c = await h.setup(), ledger = h.get(c.companyId, 'accounting/books')
  for (const code of ['2300', '2310', '2320', '2330', '2340', '2350', '2360']) ledger.books.accounts.push({ code, name: `Payroll ${code}`, type: 'Liability', cash: false })
  const result = await h.call('companyPayroll', 'accountant', { action: 'saveEmployee', input: employeeInput, expectedRevision: 0 })
  return { ...c, employeeId: result.id }
}
function payrollInput(companyId, changes = {}) { const employee = h.get(companyId, 'employees/default').employees[0]; return { reference: 'PAY-2026-09', periodStart: '2026-09-01', periodEnd: '2026-09-30', payDate: '2026-09-30', frequency: 'monthly', rows: [{ ...blankPayrollRow(employee), taxableCompensation: 2800000, withholdingTax: 200000, sssEmployee: 100000, sssEmployer: 200000 }], accounts: { ...emptyPayrollAccounts, salaryExpense: '5200', employerExpense: '5900', netPayable: '2300', sssPayable: '2310', philhealthPayable: '2320', pagibigPayable: '2330', withholdingPayable: '2340', loansPayable: '2350', otherPayable: '2360' }, calculationsReviewed: true, calculationNote: 'Illustrative reviewed manual amounts for arithmetic test, no statutory rate assertion.', ...changes } }
async function draft(companyId, changes = {}, uid = 'accountant') { return h.call('companyPayroll', uid, { action: 'saveRun', input: payrollInput(companyId, changes), expectedRevision: 0, expectedEmployeeRevision: h.get(companyId, 'employees/default').revision }) }
const approve = run => ({ action: 'approveRun', id: run.id, expectedRevision: run.version, expectedBooksRevision: 0, reviewNote: 'Independently checked employee pay, contribution assumptions, tax basis and posting accounts.' })

test('payroll denies unauthorized identities and all viewer actions despite caller role or tenant', async () => {
  const c = await setup()
  await assert.rejects(h.call('companyPayroll', 'missing', { action: 'saveEmployee', expectedRevision: 1 }), { code: 'unauthenticated' })
  for (const action of ['saveEmployee', 'saveRun', 'approveRun']) await assert.rejects(h.call('companyPayroll', 'viewer', { action, role: 'admin', companyId: c.companyId, expectedRevision: 1 }), { code: 'permission-denied' })
  h.user('disabled', { disabled: true }); await assert.rejects(h.call('companyPayroll', 'disabled', { action: 'saveEmployee', expectedRevision: 1 }), { code: 'permission-denied' })
})
test('employee saves enforce version, uniqueness and tenant source while retaining history', async () => {
  const c = await setup()
  await assert.rejects(h.call('companyPayroll', 'owner', { action: 'saveEmployee', input: employeeInput, expectedRevision: 1 }), { code: 'already-exists' })
  await assert.rejects(h.call('companyPayroll', 'owner', { action: 'saveEmployee', employeeId: c.employeeId, input: employeeInput, expectedRevision: 0 }), { code: 'aborted' })
  await h.call('companyPayroll', 'owner', { action: 'saveEmployee', employeeId: c.employeeId, input: { ...employeeInput, active: false }, expectedRevision: 1 })
  const employees = h.get(c.companyId, 'employees/default'); assert.equal(employees.revision, 2); assert.equal(employees.employees.length, 1); assert.equal(employees.employees[0].active, false)
  h.user('other'); const other = await h.call('companyCreate', 'other', { profile: h.profile })
  await assert.rejects(h.call('companyPayroll', 'other', { action: 'saveEmployee', companyId: c.companyId, employeeId: c.employeeId, input: employeeInput, expectedRevision: 0 }), { code: 'not-found' })
  assert.equal(h.get(other.companyId, 'employees/default'), undefined)
})
test('payroll drafts recompute caller totals and only their preparer can revise them', async () => {
  const c = await setup(), run = await draft(c.companyId, { totals: { netPay: 1 } })
  const stored = h.get(c.companyId, `payrollRuns/${run.id}`)
  assert.equal(stored.totals.netPay, 2700000); assert.equal(stored.status, 'draft'); assert.equal(h.get(c.companyId, 'accounting/books').revision, 0)
  await assert.rejects(h.call('companyPayroll', 'owner', { action: 'saveRun', id: run.id, input: payrollInput(c.companyId), expectedRevision: 1, expectedEmployeeRevision: 1 }), { code: 'permission-denied' })
  await assert.rejects(h.call('companyPayroll', 'accountant', { action: 'saveRun', id: run.id, input: payrollInput(c.companyId), expectedRevision: 0, expectedEmployeeRevision: 1 }), { code: 'aborted' })
})
test('approval requires independent manager, current employees, current books and review notes', async () => {
  const c = await setup(), run = await draft(c.companyId, {}, 'manager')
  await assert.rejects(h.call('companyPayroll', 'manager', approve(run)), { code: 'permission-denied' })
  await assert.rejects(h.call('companyPayroll', 'accountant', approve(run)), { code: 'permission-denied' })
  await assert.rejects(h.call('companyPayroll', 'owner', { ...approve(run), reviewNote: '' }), { code: 'invalid-argument' })
  await assert.rejects(h.call('companyPayroll', 'owner', { ...approve(run), expectedBooksRevision: 99 }), { code: 'aborted' })
  await h.call('companyPayroll', 'owner', { action: 'saveEmployee', employeeId: c.employeeId, input: { ...employeeInput, department: 'Updated' }, expectedRevision: 1 })
  await assert.rejects(h.call('companyPayroll', 'owner', approve(run)), { code: 'aborted' })
  assert.equal(h.get(c.companyId, 'accounting/books').revision, 0)
})
test('approval atomically posts one balanced ledger entry and private compensation register rows; retry is idempotent', async () => {
  const c = await setup(), run = await draft(c.companyId), before = h.auditCount(c.companyId)
  h.set(c.companyId, 'taxRegisters/default', { version: 7, records: [{ id: 'old-record', kind: 'other' }] })
  const posted = await h.call('companyPayroll', 'owner', approve(run)), ledger = h.get(c.companyId, 'accounting/books'), registers = h.get(c.companyId, 'taxRegisters/default')
  assert.equal(ledger.revision, 1); assert.equal(ledger.books.entries.length, 1); assert.equal(ledger.books.entries[0].id, posted.entryId)
  assert.equal(ledger.books.entries[0].lines.reduce((sum, line) => sum + line.debit - line.credit, 0), 0)
  assert.equal(registers.version, 8); assert.equal(registers.records.length, 2)
  const record = registers.records[1]; assert.equal(record.entryId, posted.entryId); assert.equal(record.partyName, employeeInput.fullName); assert.equal(record.tin, employeeInput.tin); assert.equal(record.address, employeeInput.address); assert.equal(record.atc, 'WC010'); assert.equal(record.taxBase, 2800000); assert.equal(record.taxAmount, 200000)
  assert.equal(h.get(c.companyId, `payrollRuns/${run.id}`).status, 'posted'); assert.equal(h.auditCount(c.companyId), before + 1)
  const again = await h.call('companyPayroll', 'manager', approve(run)); assert.equal(again.alreadyPosted, true); assert.equal(h.get(c.companyId, 'accounting/books').books.entries.length, 1); assert.equal(h.auditCount(c.companyId), before + 1)
  await assert.rejects(h.call('companyPayroll', 'accountant', { action: 'saveRun', id: run.id, input: payrollInput(c.companyId), expectedRevision: 2, expectedEmployeeRevision: 1 }), { code: 'failed-precondition' })
})
test('closed periods and missing posting accounts fail without partial payroll or tax writes', async () => {
  for (const mode of ['closed', 'account']) { h.reset(); const c = await setup(), input = mode === 'account' ? { accounts: { ...payrollInput(c.companyId).accounts, netPayable: '' } } : {}; const run = await draft(c.companyId, input)
    if (mode === 'closed') h.get(c.companyId, 'accounting/books').books.closedThrough = '2026-09-30'
    const before = h.auditCount(c.companyId)
    await assert.rejects(h.call('companyPayroll', 'owner', approve(run)), { code: 'invalid-argument' })
    assert.equal(h.get(c.companyId, 'accounting/books').revision, 0); assert.equal(h.get(c.companyId, `payrollRuns/${run.id}`).status, 'draft'); assert.equal(h.get(c.companyId, 'taxRegisters/default'), undefined); assert.equal(h.auditCount(c.companyId), before)
  }
})
test('overlapping employee payroll periods cannot be posted twice', async () => {
  const c = await setup(), first = await draft(c.companyId), second = await draft(c.companyId, { reference: 'PAY-OVERLAP', periodStart: '2026-09-15', periodEnd: '2026-10-14', payDate: '2026-10-14' })
  await h.call('companyPayroll', 'owner', approve(first))
  await assert.rejects(h.call('companyPayroll', 'owner', { ...approve(second), expectedBooksRevision: 1 }), { code: 'already-exists' })
  assert.equal(h.get(c.companyId, 'accounting/books').revision, 1)
})
test('register capacity failure rolls back approval and ledger posting', async () => {
  const c = await setup(), run = await draft(c.companyId)
  h.set(c.companyId, 'taxRegisters/default', { version: 1, records: Array.from({ length: 1000 }, (_, i) => ({ id: `record-${i}` })) })
  await assert.rejects(h.call('companyPayroll', 'owner', approve(run)), { code: 'resource-exhausted' })
  assert.equal(h.get(c.companyId, 'accounting/books').revision, 0); assert.equal(h.get(c.companyId, `payrollRuns/${run.id}`).status, 'draft'); assert.equal(h.get(c.companyId, 'taxRegisters/default').version, 1)
})
test('browser and server payroll calculations use identical source', () => {
  const fs = require('node:fs'), path = require('node:path')
  // Browser source tests import TypeScript directly; deployed Node imports emitted JavaScript.
  assert.equal(fs.readFileSync(path.resolve(__dirname, '../../src/lib/payroll.ts'), 'utf8').replace("from './payroll-statutory.ts'", "from './payroll-statutory.js'"), fs.readFileSync(path.resolve(__dirname, '../src/payroll.ts'), 'utf8'))
})
